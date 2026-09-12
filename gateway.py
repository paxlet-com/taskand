#!/usr/bin/env python3
# taskand v2.2 — Modular Gateway Entrypoint
import os
import sys
import pathlib

BASE = pathlib.Path(__file__).resolve().parent
if str(BASE) not in sys.path:
    sys.path.insert(0, str(BASE))

from gateway import main

if __name__ == "__main__":
    main()



