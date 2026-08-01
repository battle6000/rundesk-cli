"""The local console — a window onto this command, on this machine and nowhere else.

**It is not a second way into the product.** Every page it shows is the output of a
`rundesk` command run here: the console asks the same command a person types, gets the
same records, and reports the same refusals. So there is nothing it can do that the
command cannot, and nothing it knows that the command would answer differently — which is
the only reason a graphical surface can exist here at all.

**This is the first thing in rundesk that listens.** Everything else reaches outward: the
updater asks GitHub, an adapter opens its own socket inside its own program. A port on the
owner's machine is a different kind of thing, and what it does and does not earn is said
plainly under `answered`.

The shape mirrors `cli.py`'s: `answered` is the whole decision and takes everything it
needs as an argument, so every refusal is proven without a socket, a thread or a process
anywhere near it. `bound`, `serve` and the handler are the thin part that carries a real
request to it.
"""

from __future__ import annotations

import hmac
import json
import os
import re
import secrets
import signal
import subprocess
import sys
import threading
import traceback
import urllib.parse
import webbrowser
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from rundesk import ROOT, __version__

#: Where the built console stands. Beside the adapters and the agent templates: things
#: that ship and are not modules. Resolved from this file rather than from a working
#: directory, because the command is reached through a symlink on a PATH.
#:
#: It is built by `ui/` and committed, which is what lets an install need no Node, no
#: package manager and no build step (R-INS-4).
DIST = Path(__file__).resolve().parent.parent / "ui" / "dist"

#: The loopback address, written out. Never `0.0.0.0`, which would put an owner's agents
#: on their network, and never `localhost`, which goes through a resolver that can answer
#: something else.
ADDRESS = "127.0.0.1"

#: How long one `rundesk` invocation is given to answer before the console says it did
#: not. Twenty seconds because `status` reaches the backup directory, which the command
#: already bounds at the same number for the same reason.
PATIENCE_SECONDS = 20.0

#: How many `rundesk` processes may be in flight at once, ever. A page asks for several
#: things when it opens and asks again while it is watched, and a thread-per-connection
#: server with no ceiling forks one process per request: this project has already had a
#: run of unbounded process creation, and it reached four figures.
AT_MOST_AT_ONCE = 4

#: The header the console's own key arrives in. A header rather than the address, so it
#: stays out of `Referer` and out of anything's log — and a *custom* header, because a
#: page on another origin cannot set one without a preflight, and no preflight is ever
#: granted here. That makes the requirement itself the second lock behind the first.
TOKEN_HEADER = "X-Rundesk-Token"

#: What may be an agent's name in a request. Not injection defence — nothing here reaches
#: a shell — but a name beginning with a dash would be read by argparse as an option to
#: `rundesk` itself, and a request must not be able to type one.
A_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")

#: What each kind of file is served as. Written out rather than asked of `mimetypes`,
#: whose answers come from whatever `/etc/mime.types` the machine happens to have.
SERVED_AS = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".ico": "image/vnd.microsoft.icon",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
}

#: On every answer, whatever it is. The console is served from files this release shipped
#: and talks only to itself, so it declares exactly that and nothing wider.
ALWAYS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": (
        "default-src 'self'; connect-src 'self'; img-src 'self' data:; "
        "style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; "
        "base-uri 'none'; form-action 'none'"
    ),
    # Nothing is cached, assets included. This is a loopback server for a command somebody
    # explicitly started; there is no bandwidth to save, and a browser holding yesterday's
    # bundle after an update reads as a console that is broken and cannot be fixed by
    # reinstalling — which is the worst kind of bug to be told about.
    "Cache-Control": "no-store",
}

#: What the console offers, by the words it puts to the command. Read by `routed`, which
#: is the only thing that turns a request into an argument list — so what the console can
#: ask for is this table and nothing else, and a route nobody wrote reaches no command.
#:
#: Every one of them lists something and takes `--json`. Phase one shows an install; it
#: does not change one, which is why nothing here is anything but a reading.
#: Each entry is the whole command, `--json` included and placed where that verb takes it.
#: Appending the flag would have been shorter and is wrong: argparse takes an option
#: belonging to a verb *before* the action under it, so `skills catalogs --json` is an
#: unrecognized argument and `skills --json catalogs` is the same request accepted.
OFFERS = {
    ("agents",): ["agents", "--json"],
    ("status",): ["status", "--json"],
    ("skills",): ["skills", "--json"],
    ("skills", "catalogs"): ["skills", "--json", "catalogs"],
}


class Refused(Exception):
    """A request that will not be answered, and why. Raised where the reason is found."""

    def __init__(self, status: int, said: str):
        super().__init__(said)
        self.status = status
        self.said = said


@dataclass(frozen=True)
class Ran:
    """What one `rundesk` invocation ended as, and everything it said."""
    code: int
    out: str
    err: str


@dataclass(frozen=True)
class Answer:
    """One reply, decided and not yet sent."""
    status: int
    kind: str
    body: bytes
    headers: dict = field(default_factory=dict)


def built(dist: Path | None = None) -> bool:
    """Whether there is a console to serve at all.

    A directory that exists and is empty is the same failure as one that is not there, so
    this asks for the page rather than for the directory. A checkout that has never run
    the build has neither, and being handed a blank tab is the product claiming a success
    it did not earn.
    """
    return (dist if dist is not None else DIST).joinpath("index.html").is_file()


def minted() -> str:
    """The key for one run of the console.

    Made per launch, never written down, and gone when the process is. It is not a login:
    it stops a page on another origin from reaching this port through a browser, and it
    stops another person on this machine from doing so at all.

    **`RUNDESK_UI_TOKEN` fixes it, for one situation only: building the console itself.**
    A development server serves the page on a port of its own and so has no address from
    this command to take a key out of, which without this leaves every request refused and
    the person changing the console unable to see it. It is deliberately an environment
    variable rather than an option: nothing a person types by accident turns it on, and a
    key that outlives one run is exactly what the ordinary case must never have.
    """
    said = os.environ.get("RUNDESK_UI_TOKEN", "").strip()
    return said if said else secrets.token_urlsafe(32)


def invocation(*words: str) -> list[str]:
    """How this rundesk is run — this tree's own command, on this very interpreter.

    **Never the one on the PATH.** That may belong to a different install than the tree
    this console was started from, which is the ordinary case for anybody with a checkout,
    and a console describing agents the owner's command does not have is worse than no
    console at all.

    Never the shebang either: what `env python3` finds depends on whose shell started us,
    and the virtualenv was built for exactly one of them.
    """
    return [sys.executable, str(ROOT / "rundesk"), *words]


def ran(words: list[str], patience: float = PATIENCE_SECONDS) -> Ran:
    """Run one `rundesk` command and hand back everything it ended with.

    The environment is passed through as it is: the console runs as the owner and has to
    resolve the same install their shell does. Nothing is read from the caller — a command
    that asked a question would otherwise wait on an answer nobody is there to give.
    """
    try:
        done = subprocess.run(
            invocation(*words), capture_output=True, text=True,
            stdin=subprocess.DEVNULL, timeout=patience, check=False,
        )
    except subprocess.TimeoutExpired:
        raise Refused(504, f"rundesk {' '.join(words)} did not answer within "
                           f"{int(patience)} seconds")
    return Ran(done.returncode, done.stdout, done.stderr)


def segments(path: str) -> tuple[str, ...]:
    """The parts of a request's path, or nothing that could leave where it belongs.

    **Decoded first and judged second.** A path is escaped on the way in, so `%2e%2e` is
    `..` by the time anything opens it — a check that ran before the decoding would pass
    it and then follow it.
    """
    said = urllib.parse.unquote(urllib.parse.urlsplit(path).path)
    parts = tuple(part for part in said.split("/") if part)
    for part in parts:
        if part in (".", "..") or "\\" in part or "\0" in part:
            raise Refused(403, "that is not a path this serves")
    return parts


def within(dist: Path, parts: tuple[str, ...]) -> Path | None:
    """The file those parts name inside the built console, or `None` if they leave it.

    Resolved before it is judged, so a link planted inside the built files pointing
    somewhere else is refused as well — the parts having been innocent is not the
    question, where the path ends up is.
    """
    root = dist.resolve()
    try:
        candidate = root.joinpath(*parts).resolve()
    except OSError:                                     # pragma: no cover - defensive
        return None
    if candidate != root and root not in candidate.parents:
        return None
    return candidate


def routed(parts: tuple[str, ...]) -> list[str] | None:
    """The command those path parts ask for, or `None` when they ask for no command.

    An agent's name is checked here rather than wherever it lands, because the point is
    that a name which could be read as an option never becomes an argument at all.
    """
    if parts[:1] != ("api",):
        return None
    rest = parts[1:]
    if rest in OFFERS:
        return list(OFFERS[rest])
    if len(rest) == 2 and rest[0] == "agents":
        if not A_NAME.match(rest[1]):
            raise Refused(400, "that is not a name an agent can have")
        return ["agents", rest[1], "--json"]
    raise Refused(404, "this console offers nothing at that address")


def _problem(status: int, error: str, said: str, fix: str | None = None,
             **more) -> Answer:
    """A refusal, said the one way the console says them."""
    return Answer(status, "application/json; charset=utf-8", json.dumps(
        {"error": error, "said": said, "fix": fix, **more}).encode())


def _asked(words: list[str], ask) -> Answer:
    """One command run for a request, and what its ending means over HTTP.

    The exit codes are the command's own and are not flattened. `69` is this rundesk not
    having something yet, which is worth upgrading for; `2` is argparse's usage code, and
    reaching it from here means the console built the arguments wrongly, which is ours and
    not the owner's. A caller that cannot tell them apart can act on neither.
    """
    done = ask(words)
    told = " ".join(["rundesk", *words])
    if done.code == 0:
        try:
            json.loads(done.out)
        except ValueError:
            # A command that ended well and said something unparseable is a fault worth
            # naming. Passing it through as a success would break the console silently,
            # somewhere else, with nothing pointing back at the command that caused it.
            return _problem(502, "unreadable", f"{told} ended well and said no record",
                            None, ran=told)
        return Answer(200, "application/json; charset=utf-8", done.out.encode())
    said = done.err.strip() or f"{told} exited {done.code}"
    known = {1: (400, "cli_failed"), 69: (501, "not_built"), 2: (500, "internal")}
    status, error = known.get(done.code, (500, "internal"))
    return _problem(status, error, said, None, exit_code=done.code, ran=told,
                    stderr=done.err)


def _file(dist: Path, parts: tuple[str, ...]) -> Answer:
    """One of the built files, or an honest miss.

    **Nothing falls back to the page.** The console finds its way around inside a fragment,
    so every request that arrives here is for `/` or for a file that should exist — and
    answering a missing script with HTML hands a page to a parser that wanted code, which
    fails somewhere unrelated and says nothing about the file that was not there.
    """
    at = within(dist, parts or ("index.html",))
    if at is None:
        raise Refused(403, "that is not a path this serves")
    if at.is_dir():
        at = at / "index.html"
    if not at.is_file():
        raise Refused(404, "this console has no such file")
    return Answer(200, SERVED_AS.get(at.suffix, "application/octet-stream"),
                  at.read_bytes())


def answered(method: str, path: str, headers, *, token: str, at: str,
             dist: Path, ask) -> Answer:
    """What this request is answered with. The whole of the decision, and all of it here.

    Everything it needs is an argument, so every refusal below is proven without a socket,
    a thread or a process — which is what makes a listening surface testable at all.

    The order is deliberate; each check is cheaper and broader than the one after it.

    1. **Only reading.** Phase one shows an install and does not change one, so anything
       that is not a read is refused at the door rather than in each route. It also takes
       the ordinary cross-site write away entirely: there is nothing to write.
    2. **The address it thinks it reached.** This is the defence against a name that
       resolves here. Anyone can point `evil.example` at `127.0.0.1`; the browser still
       says `Host: evil.example`, and this refuses it. Compared whole, never by prefix.
    3. **Where the page asking came from**, when it says.
    4. **The console's own key**, on what carries the owner's data. The built files do not:
       they are what this release shipped, and the key reaches the page through them.
    5. **Where the path leads**, decoded first and resolved before it is judged.

    **What this does not earn, said plainly.** Any program running as this owner can reach
    a loopback port, and the key does not change that — such a program could simply run
    `rundesk` itself. What the key is for is the browser: a page somewhere else cannot read
    this, and another person on this machine cannot either.
    """
    try:
        if method not in ("GET", "HEAD"):
            return _problem(405, "forbidden", "this console only reads")
        if (headers.get("Host") or "") != at:
            return _problem(403, "forbidden", "this console answers only to itself")
        origin = headers.get("Origin")
        if origin and origin != f"http://{at}":
            return _problem(403, "forbidden", "that page is not this console")
        fetched_from = headers.get("Sec-Fetch-Site")
        if fetched_from and fetched_from not in ("same-origin", "none"):
            return _problem(403, "forbidden", "that page is not this console")
        parts = segments(path)
        words = routed(parts)
        if words is None:
            return _file(dist, parts)
        offered = headers.get(TOKEN_HEADER) or ""
        if not hmac.compare_digest(offered, token):
            return _problem(401, "unauthorized", "this window's key is not this console's",
                            "rundesk ui")
        return _asked(words, ask)
    except Refused as why:
        known = {400: "forbidden", 403: "forbidden", 404: "not_found", 504: "cli_failed"}
        return _problem(why.status, known.get(why.status, "internal"), why.said)
    except Exception as broke:
        # **A fault here still leaves by the front door.** This is a request boundary, so
        # the alternative is not "no answer" — it is the standard library's own error page,
        # which is HTML, carries no reason a caller can read, and reaches an owner as a
        # number and nothing else. What went wrong is written where a fault belongs, and
        # said in the shape everything else here is said in.
        traceback.print_exc()
        return _problem(500, "internal",
                        f"the console failed on {method} {path.split('?')[0]} — "
                        f"{type(broke).__name__}: {broke}")


def handler(*, token: str, dist: Path, ask, at):
    """The class a server hands each request to. Made per server, because what it checks
    against — the key, and the address that was actually bound — is that server's."""
    running = threading.Semaphore(AT_MOST_AT_ONCE)

    class Console(BaseHTTPRequestHandler):
        # A browser opens several connections at once, so a keep-alive answer is the
        # difference between a console that appears and one that appears to hang. Every
        # answer therefore carries its length, refusals included: HTTP/1.1 without one is
        # a connection the browser waits on forever, on a blank tab.
        protocol_version = "HTTP/1.1"
        server_version = f"rundesk/{__version__}"
        sys_version = ""
        timeout = 30

        def _answer(self, said: Answer, body: bool = True) -> None:
            self.send_response(said.status)
            self.send_header("Content-Type", said.kind)
            self.send_header("Content-Length", str(len(said.body)))
            for name, value in {**ALWAYS, **said.headers}.items():
                self.send_header(name, value)
            self.end_headers()
            if body:
                self.wfile.write(said.body)

        def _run(self, body: bool) -> None:
            with running:
                said = answered(self.command, self.path, self.headers,
                                token=token, at=at(), dist=dist, ask=ask)
            self._answer(said, body)

        def do_GET(self):
            self._run(body=True)

        def do_HEAD(self):
            self._run(body=False)

        def do_POST(self):
            self._answer(_problem(405, "forbidden", "this console only reads"))

        do_PUT = do_PATCH = do_DELETE = do_POST

        def log_message(self, fmt, *args):
            """What went wrong, and nothing else.

            A page load is a dozen requests, and a console that narrates every one of them
            buries the one line an owner needed to see. A refusal is worth a line: it means
            something asked for what this will not give.
            """
            said = fmt % args
            if not re.search(r'" (?:2|3)\d\d ', said):
                print(f"ui: refused — {said}", file=sys.stderr)

    return Console


def bound(*, token: str, dist: Path | None = None, ask=None, port: int = 0,
          address: str = ADDRESS) -> ThreadingHTTPServer:
    """A server listening on this machine, and nowhere else.

    Port `0` by default, so the machine picks one that is free and two consoles never
    fight over one. A port that was asked for and is taken raises rather than quietly
    moving: an address that is not the one somebody asked for is a lie they will bookmark.
    """
    dist = DIST if dist is None else dist
    ask = ran if ask is None else ask
    where: dict = {}
    server = ThreadingHTTPServer(
        (address, port), handler(token=token, dist=dist, ask=ask,
                                 at=lambda: where["at"]))
    # Daemon threads, so a connection a browser left open cannot hold the process up when
    # the owner has asked it to stop.
    server.daemon_threads = True
    where["at"] = f"{address}:{server.server_address[1]}"
    return server


def address_of(server: ThreadingHTTPServer, token: str) -> str:
    """Where to open, key and all.

    In the fragment rather than the query, which costs nothing and is worth having: a
    fragment is never sent to any server, so it cannot reach a log, and it cannot leak
    through `Referer`. The page takes it from there and sends it as a header afterwards.
    """
    host, port = server.server_address[0], server.server_address[1]
    return f"http://{host}:{port}/#t={token}"


def serve(server: ThreadingHTTPServer) -> None:
    """Answer until something stops it.

    Ctrl-C arrives as `KeyboardInterrupt` and is the caller's to catch. A `SIGTERM` is
    answered from a thread of its own, because `shutdown` waits for the serving loop to
    notice and calling it from inside that loop waits forever.
    """
    def stop(*_):
        threading.Thread(target=server.shutdown, daemon=True).start()

    was = {}
    for caught in (signal.SIGTERM, signal.SIGHUP):
        try:
            was[caught] = signal.signal(caught, stop)
        except (ValueError, OSError):                   # pragma: no cover - not main thread
            pass
    try:
        server.serve_forever(poll_interval=0.2)
    finally:
        for caught, before in was.items():
            try:
                signal.signal(caught, before)
            except (ValueError, OSError):               # pragma: no cover - defensive
                pass
        server.server_close()


def open_browser(where: str) -> bool:
    """Show it, if this machine has somewhere to show it.

    Never fatal. Over SSH, or on a machine with no browser, this fails or opens something
    nobody wanted — and the address has already been printed, which is the part that
    matters.
    """
    if os.environ.get("RUNDESK_UI_NO_BROWSER"):
        return False
    try:
        return bool(webbrowser.open(where))
    except Exception:                                   # pragma: no cover - defensive
        return False
