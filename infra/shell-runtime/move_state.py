#!/usr/bin/env python3
"""Move one known state directory after service stop; allow identical retries."""
import argparse
from pathlib import Path


def move_state(source, destination, device, inode):
    source, destination = Path(source).absolute(), Path(destination).absolute()
    for path in (source, destination):
        if any(p.is_symlink() for p in (path, *path.parents)):
            raise ValueError("State symlinks are forbidden")
    if source.exists() and destination.exists():
        raise ValueError("Both state directories exist; refusing overwrite")
    current = source if source.exists() else destination
    stat = current.stat()
    if not current.is_dir() or (stat.st_dev, stat.st_ino) != (device, inode):
        raise ValueError("State directory identity changed")
    if current == source:
        source.rename(destination)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("device", type=int)
    parser.add_argument("inode", type=int)
    args = parser.parse_args()
    move_state(args.source, args.destination, args.device, args.inode)
