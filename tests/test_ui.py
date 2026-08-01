#!/usr/bin/env python3
"""The local console: what it answers, and everything it refuses.

**Nothing here binds a socket except the two cases that are about binding one, and
nothing here ever runs `rundesk`.** That is the whole reason `ui.answered` takes what it
needs as arguments: a listening surface whose decision is a function is one whose refusals
can be proven without a port, a thread, or a process that might outlive the case.

`ask=` is a stand-in in every case, without exception. The real one starts a process, and
a suite that can reach it is a suite that can leave one behind — this project has had a
run of unbounded process creation once already, and it reached four figures.

Run: python3 tests/test_ui.py
"""

from __future__ import annotations

import json
import shutil
import socket
import sys
import threading
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from rundesk import __version__  # noqa: E402
from rundesk import ui  # noqa: E402

#: The address a case pretends it was reached on. What matters is that the request agrees
#: with it, never the number.
AT = "127.0.0.1:54321"

#: A key of the right shape. Never a real one — `minted` is what makes those, and the case
#: about it is below.
KEY = "a-key-that-is-this-consoles-own"


def told(**more) -> dict:
    """The headers of a request that is in order, with anything a case wants changed."""
    return {"Host": AT, ui.TOKEN_HEADER: KEY, **more}


def answering(code=0, out=None, err="") -> tuple:
    """A stand-in for the command, and the list of what it was asked."""
    asked: list = []

    def ask(words):
        asked.append(words)
        said = out if out is not None else json.dumps(
            {"rundesk": __version__, "command": words[0], "shown": []})
        return ui.Ran(code, said, err)

    return ask, asked


class TheConsoleOnlyAnswersItself(unittest.TestCase):
    """The first listening surface in the product, and what it will not do."""

    def setUp(self):
        self.dist = Path(tempfile.mkdtemp(prefix="rundesk-ui-dist-"))
        self.addCleanup(shutil.rmtree, self.dist, ignore_errors=True)
        (self.dist / "index.html").write_text("<title>rundesk</title>")
        (self.dist / "assets").mkdir()
        (self.dist / "assets" / "app.js").write_text("console.log(1)")
        # Never the real built console: this suite has to pass in a checkout that has
        # never run the build, which is every CI runner and most first clones.
        self.ask, self.asked = answering()

    def answer(self, method="GET", path="/api/agents", headers=None, ask=None):
        return ui.answered(method, path, told() if headers is None else headers,
                           token=KEY, at=AT, dist=self.dist,
                           ask=self.ask if ask is None else ask)

    # ---------------------------------------------------------------- who is asking

    def test_a_request_from_another_host_is_refused(self):
        """The defence against a name that resolves here.

        Anybody may point `evil.example` at 127.0.0.1 and have a page they wrote reach
        this port. The browser still says which name it thinks it reached, and that is
        the one thing the attacker cannot forge.
        """
        said = self.answer(headers=told(Host="evil.example"))
        self.assertEqual(403, said.status)
        self.assertEqual([], self.asked)

    def test_a_host_that_merely_begins_the_right_way_is_still_another_host(self):
        # Compared whole. `127.0.0.1:54321.evil.example` starts with the right text.
        said = self.answer(headers=told(Host=f"{AT}.evil.example"))
        self.assertEqual(403, said.status)

    def test_a_request_naming_the_port_it_reached_is_answered(self):
        said = self.answer()
        self.assertEqual(200, said.status)
        self.assertEqual([["agents", "--json"]], self.asked)

    def test_a_request_that_smells_of_another_site_is_refused(self):
        for header, value in (("Origin", "http://evil.example"),
                              ("Sec-Fetch-Site", "cross-site")):
            with self.subTest(header=header):
                said = self.answer(headers=told(**{header: value}))
                self.assertEqual(403, said.status)
                self.assertEqual([], self.asked)

    def test_a_page_opened_by_typing_its_address_carries_no_origin_and_is_answered(self):
        # A top-level navigation sends no Origin at all, and `none` is what a browser
        # calls a request it made because somebody typed it.
        said = ui.answered("GET", "/api/agents", told(**{"Sec-Fetch-Site": "none"}),
                           token=KEY, at=AT, dist=self.dist, ask=self.ask)
        self.assertEqual(200, said.status)

    # ---------------------------------------------------------------- the key

    def test_a_request_without_the_token_is_refused(self):
        said = self.answer(headers={"Host": AT})
        self.assertEqual(401, said.status)
        self.assertEqual([], self.asked)

    def test_a_request_with_the_wrong_token_is_refused(self):
        said = self.answer(headers=told(**{ui.TOKEN_HEADER: "not-the-key"}))
        self.assertEqual(401, said.status)
        self.assertEqual([], self.asked)

    def test_the_token_is_different_every_time_the_console_starts(self):
        # A key that repeated would be one a page could keep from a previous run.
        made = {ui.minted() for _ in range(50)}
        self.assertEqual(50, len(made))
        self.assertTrue(all(len(one) >= 22 for one in made))

    def test_the_built_files_need_no_token_and_carry_nothing_of_an_owners(self):
        # The key reaches the page through these, so they cannot require it. They are
        # what this release shipped and hold nothing an owner typed.
        said = ui.answered("GET", "/assets/app.js", {"Host": AT},
                           token=KEY, at=AT, dist=self.dist, ask=self.ask)
        self.assertEqual(200, said.status)
        self.assertEqual(b"console.log(1)", said.body)

    # ---------------------------------------------------------------- where it leads

    def test_a_path_that_climbs_out_of_the_built_files_is_refused(self):
        for path in ("/../../etc/passwd", "/assets/../../../etc/passwd", "/..%2f..%2fetc"):
            with self.subTest(path=path):
                said = ui.answered("GET", path, {"Host": AT}, token=KEY, at=AT,
                                   dist=self.dist, ask=self.ask)
                self.assertEqual(403, said.status)

    def test_a_path_is_refused_for_climbing_before_anything_resolves_it(self):
        """The two guards are independent, and this is the one that has no filesystem.

        Where a path resolves catches the same attempt a moment later, which is exactly
        why this needs a case of its own: with the resolving guard in place, taking this
        one out changed nothing that was being asserted, and a check nothing proves is a
        check that will be removed by somebody tidying up.
        """
        for path in ("/../etc/passwd", "/assets/../../x", "/./../x", "/a\\b", "/a\0b"):
            with self.subTest(path=path):
                with self.assertRaises(ui.Refused) as refused:
                    ui.segments(path)
                self.assertEqual(403, refused.exception.status)
        # And a path that climbs nowhere is simply its parts.
        self.assertEqual(("assets", "app.js"), ui.segments("/assets/app.js?v=2"))

    def test_an_escaped_path_is_judged_after_it_is_decoded(self):
        # `%2e%2e` is `..` by the time anything opens it, so a check that ran first would
        # pass it and then follow it.
        said = ui.answered("GET", "/%2e%2e/%2e%2e/etc/passwd", {"Host": AT},
                           token=KEY, at=AT, dist=self.dist, ask=self.ask)
        self.assertEqual(403, said.status)

    def test_a_link_out_of_the_built_files_is_refused(self):
        # Innocent parts are not the question; where the path ends up is.
        secret = Path(tempfile.mkdtemp(prefix="rundesk-ui-elsewhere-"))
        self.addCleanup(shutil.rmtree, secret, ignore_errors=True)
        (secret / "credentials").write_text("not yours")
        (self.dist / "out").symlink_to(secret)
        said = ui.answered("GET", "/out/credentials", {"Host": AT}, token=KEY, at=AT,
                           dist=self.dist, ask=self.ask)
        self.assertEqual(403, said.status)

    def test_the_console_itself_is_what_the_bare_address_answers(self):
        said = ui.answered("GET", "/", {"Host": AT}, token=KEY, at=AT,
                           dist=self.dist, ask=self.ask)
        self.assertEqual(200, said.status)
        self.assertIn(b"rundesk", said.body)

    def test_a_missing_asset_is_a_miss_rather_than_the_console_itself(self):
        # Handing HTML to something that asked for a script fails somewhere unrelated
        # and says nothing about the file that was not there.
        said = ui.answered("GET", "/assets/gone.js", {"Host": AT}, token=KEY, at=AT,
                           dist=self.dist, ask=self.ask)
        self.assertEqual(404, said.status)

    def test_an_address_this_console_does_not_offer_is_a_miss_and_runs_nothing(self):
        said = self.answer(path="/api/nothing-like-this")
        self.assertEqual(404, said.status)
        self.assertEqual([], self.asked)

    # ---------------------------------------------------------------- what it will not do

    def test_nothing_the_console_offers_can_change_anything(self):
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            with self.subTest(method=method):
                said = self.answer(method=method)
                self.assertEqual(405, said.status)
                self.assertEqual([], self.asked)

    def test_every_route_it_offers_only_reads(self):
        # Read off the table rather than restated, so a route that changed something
        # would have to be added here to pass.
        for words in ui.OFFERS.values():
            with self.subTest(words=words):
                self.assertIn(words[0], ("agents", "status", "skills"))

    def test_what_the_console_serves_may_not_be_framed_or_sniffed(self):
        for name in ("X-Content-Type-Options", "X-Frame-Options",
                     "Referrer-Policy", "Content-Security-Policy"):
            self.assertIn(name, ui.ALWAYS)
        self.assertIn("frame-ancestors 'none'", ui.ALWAYS["Content-Security-Policy"])
        self.assertEqual("no-store", ui.ALWAYS["Cache-Control"])

    def test_an_agent_name_that_would_read_as_an_option_never_becomes_one(self):
        # No shell is involved, so this is not injection. A name beginning with a dash
        # would be read by argparse as an option to `rundesk` itself.
        for name in ("--purge", "-rf", "..", "a" * 80):
            with self.subTest(name=name):
                said = self.answer(path=f"/api/agents/{name}")
                self.assertIn(said.status, (400, 403, 404))
                self.assertEqual([], self.asked)

    def test_a_name_an_agent_can_have_reaches_the_command_as_one_word(self):
        said = self.answer(path="/api/agents/ava")
        self.assertEqual(200, said.status)
        self.assertEqual([["agents", "ava", "--json"]], self.asked)

    # ---------------------------------------------------------------- what a command said

    def test_a_command_this_rundesk_has_not_built_is_answered_as_not_implemented(self):
        ask, _ = answering(code=ui_not_available(), out="", err="agents: NOT AVAILABLE")
        said = self.answer(ask=ask)
        self.assertEqual(501, said.status)
        self.assertEqual("not_built", json.loads(said.body)["error"])

    def test_a_command_that_failed_is_answered_with_what_it_said(self):
        ask, _ = answering(code=1, out="", err="ava: NO SUCH AGENT\n")
        said = self.answer(ask=ask)
        self.assertEqual(400, said.status)
        body = json.loads(said.body)
        self.assertEqual("cli_failed", body["error"])
        self.assertEqual("ava: NO SUCH AGENT", body["said"])
        self.assertEqual(1, body["exit_code"])

    def test_a_command_typed_wrongly_by_the_console_is_the_consoles_fault(self):
        # Argparse's usage code, reached from a request, means the console built the
        # arguments wrongly. That is ours, and it is never reported as the owner's.
        ask, _ = answering(code=2, out="", err="usage: rundesk")
        said = self.answer(ask=ask)
        self.assertEqual(500, said.status)

    def test_a_command_that_ended_well_and_said_nothing_readable_is_not_passed_on(self):
        # A 200 carrying something that is not a record is a console that breaks
        # silently, somewhere else, with nothing pointing back at the cause.
        ask, _ = answering(code=0, out="no agents\n")
        said = self.answer(ask=ask)
        self.assertEqual(502, said.status)

    def test_a_command_that_never_answered_is_given_up_on(self):
        def never(words):
            raise ui.Refused(504, "rundesk agents did not answer within 20 seconds")
        said = self.answer(ask=never)
        self.assertEqual(504, said.status)

    def test_a_failure_with_nothing_said_still_names_what_happened(self):
        # A blank error is a console showing an owner an empty box.
        ask, _ = answering(code=1, out="", err="   \n")
        said = self.answer(ask=ask)
        self.assertIn("exited 1", json.loads(said.body)["said"])

    # ---------------------------------------------------------------- which rundesk

    def test_the_console_asks_the_rundesk_it_is_part_of(self):
        """Never the one on the PATH.

        That may belong to a different install than the tree this console was started
        from, which is the ordinary case for anybody with a checkout — and a console
        describing agents the owner's command does not have is worse than none.
        """
        words = ui.invocation("agents", "--json")
        self.assertEqual(sys.executable, words[0])
        self.assertEqual(str(Path(ui.ROOT) / "rundesk"), words[1])
        self.assertEqual(["agents", "--json"], words[2:])

    def test_the_console_refuses_to_start_when_it_has_not_been_built(self):
        # A directory that is there and empty is the same failure as one that is not.
        empty = Path(tempfile.mkdtemp(prefix="rundesk-ui-unbuilt-"))
        self.addCleanup(shutil.rmtree, empty, ignore_errors=True)
        self.assertFalse(ui.built(empty))
        self.assertTrue(ui.built(self.dist))


class TheConsoleListensNowhereElse(unittest.TestCase):
    """The two cases that bind. Neither serves: a socket opened and closed inside one
    case leaks nothing, and `serve_forever` in a suite is a suite that never finishes."""

    def setUp(self):
        self.dist = Path(tempfile.mkdtemp(prefix="rundesk-ui-bind-"))
        self.addCleanup(shutil.rmtree, self.dist, ignore_errors=True)
        (self.dist / "index.html").write_text("<title>rundesk</title>")

    def test_the_console_listens_only_on_this_machine(self):
        ask, _ = answering()
        server = ui.bound(token=KEY, dist=self.dist, ask=ask, port=0)
        self.addCleanup(server.server_close)
        self.assertEqual("127.0.0.1", server.server_address[0])
        self.assertEqual(socket.AF_INET, server.address_family)
        self.assertNotEqual(0, server.server_address[1])

    def test_the_address_it_prints_carries_the_key_where_no_server_will_see_it(self):
        # In the fragment. It never reaches a server, so it cannot reach a log, and it
        # cannot leak through `Referer`.
        ask, _ = answering()
        server = ui.bound(token=KEY, dist=self.dist, ask=ask, port=0)
        self.addCleanup(server.server_close)
        where = ui.address_of(server, KEY)
        self.assertTrue(where.startswith("http://127.0.0.1:"))
        self.assertIn(f"/#t={KEY}", where)
        self.assertNotIn("?", where)


class TheCommittedConsoleIsWhatItsSourceBuilds(unittest.TestCase):
    """The built console is committed, and that is two ways to be wrong.

    **Stale** — somebody changed `ui/` and did not rebuild, so what ships is not what the
    source says. Nothing looks broken; it is simply the wrong console. **Tampered** —
    somebody edited the minified bundle to fix something quickly, and now the source can
    never reproduce it and the next honest build silently reverts the fix.

    Asserted here, in Python, on purpose: the people who work on this repo are Python
    contributors, and a guard that only runs where Node is installed is one most of them
    will never see. CI rebuilds and compares the bytes as well; this is what catches it
    first, and locally.
    """

    def setUp(self):
        self.dist = Path(ui.DIST)
        if not (self.dist / "build-info.json").is_file():
            # A checkout that has never built the console is a normal state — the module
            # already refuses honestly, and there is nothing here to check.
            self.skipTest("this checkout has no built console")
        self.built = json.loads((self.dist / "build-info.json").read_text())

    def test_every_file_that_shipped_is_the_file_that_was_built(self):
        import hashlib

        for named, recorded in sorted(self.built["files"].items()):
            with self.subTest(file=named):
                at = self.dist / named
                self.assertTrue(at.is_file(), f"{named} was recorded and is not there")
                measured = hashlib.sha256(at.read_bytes()).hexdigest()
                self.assertEqual(recorded, f"sha256:{measured}",
                                 f"{named} is not the file the build produced")

    def test_nothing_shipped_that_the_build_did_not_produce(self):
        # The other direction. A file added by hand would otherwise sit there unnamed.
        found = {str(at.relative_to(self.dist)) for at in self.dist.rglob("*")
                 if at.is_file() and at.name != "build-info.json"}
        self.assertEqual(set(self.built["files"]), found)

    def test_the_console_that_shipped_was_built_from_the_source_beside_it(self):
        """The stale check. Recomputed the way the stamp computes it, or it proves nothing."""
        import hashlib

        workspace = Path(ui.DIST).resolve().parent.parent.parent / "ui"
        if not workspace.is_dir():
            self.skipTest("this install carries no workspace, only the built console")
        not_source = {"node_modules", "dist", ".vite", ".git"}
        sources = []
        for at in sorted(workspace.rglob("*")):
            parts = set(at.relative_to(workspace).parts)
            if not at.is_file() or not_source & parts or at.name.startswith(".env"):
                continue
            sources.append(at.relative_to(workspace).as_posix())
        measured = hashlib.sha256("".join(
            f"{named}\0{hashlib.sha256((workspace / named).read_bytes()).hexdigest()}\n"
            for named in sorted(sources)).encode()).hexdigest()
        self.assertEqual(
            self.built["sources_sha256"], measured,
            "the committed console is not what ui/ builds — run: npm run --prefix ui build")

    def test_the_console_that_shipped_belongs_to_this_release(self):
        self.assertEqual(__version__, self.built["ui_version"])

    def test_the_page_asks_only_for_files_that_shipped_with_it(self):
        # A page referring to something absent is a console that half-loads, and the
        # first anyone hears of it is a blank panel.
        import re as _re

        page = (self.dist / "index.html").read_text()
        for asked in _re.findall(r'(?:src|href)="([^"]+)"', page):
            if asked.startswith(("http://", "https://", "data:", "//")):
                continue
            with self.subTest(asked=asked):
                self.assertTrue((self.dist / asked.lstrip("./")).is_file(),
                                f"the page asks for {asked} and it is not there")


class TheAddressReachesWhoeverStartedIt(unittest.TestCase):
    """The one case that runs the real command, because the fault is in the plumbing.

    Nothing a stand-in can show: `answered` is not involved, and neither is the server.
    What went wrong is that Python buffers stdout in blocks when it is not a terminal, and
    a command that then serves forever never fills the buffer — so the address arrived
    only when the process was killed, which is exactly when it stops being useful.
    """

    def test_the_address_is_readable_before_the_console_has_stopped(self):
        import os
        import subprocess

        repo = Path(__file__).resolve().parent.parent
        # A station of its own, so nothing here reads or writes the owner's install.
        station = Path(tempfile.mkdtemp(prefix="rundesk-ui-station-"))
        self.addCleanup(shutil.rmtree, station, ignore_errors=True)
        # A console of its own too, so this passes in a checkout that never built one.
        dist = station / "dist"
        dist.mkdir()
        (dist / "index.html").write_text("<title>rundesk</title>")

        env = {k: v for k, v in os.environ.items() if not k.startswith("RUNDESK_")}
        env.update({
            "RUNDESK_INSTALL_DIR": str(station), "RUNDESK_DATA_DIR": str(station / "data"),
            "RUNDESK_BACKUP_DIR": str(station / "backups"),
            "RUNDESK_JOBS_DIR": str(station / "jobs"),
            "RUNDESK_JOB_PREFIX": "ai.rundesk-station",
            "RUNDESK_UI_NO_BROWSER": "1",
            # Point the module at the console this case made, so a checkout with none
            # still runs it. Read where `DIST` is read, which is why it can be given.
            "PYTHONPATH": str(repo / "src"),
        })
        started = subprocess.Popen(
            [sys.executable, "-c",
             "import sys; from rundesk import cli, ui; "
             f"ui.DIST = __import__('pathlib').Path({str(dist)!r}); "
             "sys.exit(cli.main(['ui', '--port', '0', '--no-open']))"],
            cwd=str(repo), env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True,
        )
        self.addCleanup(lambda: [s.close() for s in (started.stdout, started.stderr) if s])
        self.addCleanup(started.wait)
        self.addCleanup(started.kill)

        # **Read on a thread with a bound, rather than straight.** Without the flush this
        # line never arrives at all, and a case that waited for it would hang — holding
        # the whole gate open rather than failing it. A bounded read turns the same fault
        # into a failure somebody can read.
        said: list = []
        reader = threading.Thread(
            target=lambda: said.append(started.stdout.readline()), daemon=True)
        reader.start()
        reader.join(20.0)
        self.assertTrue(said, "the address never arrived while the console was serving")
        self.assertIn("the console is at http://127.0.0.1:", said[0])
        self.assertIn("/#t=", said[0])
        self.assertIsNone(started.poll(), "it printed the address and then stopped")


def ui_not_available() -> int:
    """What a verb that is registered and not built exits with, borrowed rather than
    written down again — a second copy of it is one that drifts from the first."""
    from rundesk import cli
    return cli.NOT_AVAILABLE


if __name__ == "__main__":
    unittest.main(verbosity=2)
