---
id: CON
name: The local console
---

## What this is

An optional window onto the command, opened deliberately and reachable only from the machine it runs on.
It offers no operation the command does not, because every page on it is the output of a command run
locally. This release shows an install and does not change one.

## Why it exists

- An owner can see what their agents are doing without holding the command surface in their head.
- What is shown is what the command says, so the two can never disagree about an install.
- A person who never opens it loses nothing: the command remains the whole product.

## Requirements

|  | ID | Requirement | Evidence |
|:--:|---|---|---|
| ✅ | R-CON-1 | Every listing the command shows can be asked for as one machine-readable record | `a listing asked for as json is one document that parses` |
| ✅ | R-CON-2 | What the columns show and what the record says are the same rows | `what the columns show and what json says are the same rows` |
| ✅ | R-CON-3 | What a command says beside its listing never enters the record | `json is not corrupted by what a command says beside its table` |
| ✅ | R-CON-4 | An install holding nothing answers that it holds nothing | `an install with no agents says it has none rather than saying nothing` |
| ✅ | R-CON-5 | Asking for a record leaves what went wrong where failures are read | `asking for json leaves what went wrong on the error stream` |
| ✅ | R-CON-6 | How a command was asked changes what is shown and never how it ended | `a command that failed ends the way it would have without json` |
| ✅ | R-CON-7 | Only an operation that lists something offers the record form | `a verb that lists nothing is never offered the flag` |
| ✅ | R-CON-8 | The console starts only when it is explicitly asked for | `the console verb says where it is and serves until it is stopped` |
| ✅ | R-CON-9 | The console listens on the machine it was started on and nowhere else | `the console listens only on this machine` |
| ✅ | R-CON-10 | A request naming an address the console did not bind is refused | `a request from another host is refused` |
| ✅ | R-CON-11 | A page belonging to somewhere else is refused | `a request that smells of another site is refused` |
| ✅ | R-CON-12 | Reaching an owner's install requires the key minted for that window | `a request without the token is refused` |
| ✅ | R-CON-13 | Every run of the console mints a key of its own | `the token is different every time the console starts` |
| ✅ | R-CON-14 | The key never travels anywhere a server or a log would keep it | `the address it prints carries the key where no server will see it` |
| ✅ | R-CON-15 | Nothing the console offers changes anything | `nothing the console offers can change anything` |
| ✅ | R-CON-16 | A path leading outside what shipped is refused | `a path that climbs out of the built files is refused` |
| ✅ | R-CON-17 | An escaped path is judged after it is decoded | `an escaped path is judged after it is decoded` |
| ✅ | R-CON-18 | A link out of what shipped is refused | `a link out of the built files is refused` |
| ✅ | R-CON-19 | A name that would be read as an option never becomes an argument | `an agent name that would read as an option never becomes one` |
| ✅ | R-CON-20 | The console asks the copy of rundesk it is part of | `the console asks the rundesk it is part of` |
| ✅ | R-CON-21 | An operation this rundesk has not built is reported as unavailable rather than failed | `a command this rundesk has not built is answered as not implemented` |
| ✅ | R-CON-22 | An operation that failed is reported with what it said | `a command that failed is answered with what it said` |
| ✅ | R-CON-23 | An answer that is not a record is refused rather than passed on | `a command that ended well and said nothing readable is not passed on` |
| ✅ | R-CON-24 | An operation that never answers is given up on | `a command that never answered is given up on` |
| ✅ | R-CON-25 | A rundesk carrying no console refuses to open one | `the console refuses to start when it has not been built` |
| ✅ | R-CON-26 | An address that was asked for and cannot be had is refused rather than exchanged | `a port that cannot be had fails rather than moving to another` |
| ✅ | R-CON-27 | Where the console is reachable is readable before it stops | `the address is readable before the console has stopped` |
| ✅ | R-CON-28 | The console that ships is the one its source builds | `the console that shipped was built from the source beside it` |
| ✅ | R-CON-29 | Every file that ships is the file the build produced | `every file that shipped is the file that was built` |
| ✅ | R-CON-30 | Serving the console needs nothing beyond what an install already carries | `everything the code imports is the standard library or declared` |
| ❌ | R-CON-31 | An owner's pages can be read through the console | — |
| ❌ | R-CON-32 | An owner's pages can be changed through the console | — |
| ❌ | R-CON-33 | A change made elsewhere while a page was open is detected rather than overwritten | — |
| ❌ | R-CON-34 | An agent can be started and stood down through the console | — |
| ❌ | R-CON-35 | A skill can be granted and revoked through the console | — |
| ❌ | R-CON-36 | Removing anything through the console is confirmed first | — |

## Open questions

- Whether reading an owner's pages is a verb of its own or an argument to one that exists.
- Whether the rows above about the record form belong here or graduate into the command's own contract.
- What the console shows of a run in progress, given nothing streams to it today.
- Whether an owner may point the console at a fixed address that outlives one run of it.
