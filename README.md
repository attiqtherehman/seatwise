# 🪑 Seating Arrangement System

Generate exam seating plans from a CSV of students — with the guarantee that **no two students of the same section sit next to each other**: not front-back, not left-right, and not diagonally.

Zero dependencies, no build step: open `index.html` in a browser and it works.

> Originally built in 2019 as an *Analysis of Algorithms* project at the Computer Science Department, **UET Lahore**. Modernized in 2026.

**Live demo:** https://attiqtherehman.github.io/seatingArrangementSystem/

The original 2019 version is preserved on the [`old-version`](https://github.com/attiqtherehman/seatingArrangementSystem/tree/old-version) branch (tag `v1.0`).

## Features

- **CSV input** via file picker or drag & drop, with optional header row, blank-line skipping, and per-line error reporting
- **One-click sample data** ([sample.csv](sample.csv)) to try it instantly
- **Configurable rooms** — columns per room × seats per column
- **Visual seat grid**, color-coded by section, so a correct arrangement is visible at a glance
- **Two views**: Room-wise (the seat grid, for exam halls) and Section-wise (a per-section list for notice boards)
- **Export** the plan as CSV, or **print** it (print-friendly styles included)
- **Dead-end handling you choose up front**: leave empty seats between clashing students, or seat them anyway with conflicts highlighted

## CSV format

One student per line, first column registration number, second column section. A header row is optional.

```csv
Registration No,Section
2019-CS-001,A
2019-CS-002,A
2019-CS-041,B
```

## The algorithm

Seats fill **column-major**: column 1 top to bottom, then column 2, and so on; a new room starts when one fills up. At placement time a seat is checked against the already-filled neighbours: the seat **in front of it** (previous seat in the same column), the seat **to its left** (same row, previous column) and the **two left-hand diagonals** — all derived from room-local coordinates, so constraints never leak across rooms. The relation is symmetric, so the finished plan has no same-section pair in any of the 8 surrounding seats.

At every seat the algorithm greedily picks the **eligible section with the most students remaining**. Largest-first interleaving keeps the big sections from being left over at the end, which is what makes plain round-robin dead-end.

```text
arrange(students, columns, rows):
    groups = students grouped by section
    seats  = []
    while students remain:
        sort groups by remaining count, descending
        pick the first group whose section differs from the front,
             left, and both left-diagonal neighbours of the next seat
        if a group qualifies:
            seat its next student
        else:                      # dead end — every section clashes
            strategy "spaces":     leave the seat empty and continue
            strategy "as-is":      seat the largest group anyway, mark conflict
    return seats
```

With the *empty seats* strategy the loop always terminates: an empty seat blocks nothing, so the algorithm is always able to seat students again after a bounded run of empty seats (at worst about one column, when a single section is left over).

**Complexity:** O(n · k log k) for *n* students and *k* sections (a sort of the k groups per seat) — effectively instant for any realistic exam.

## Running locally

No server needed — just open `index.html`. To develop with live reload, any static file server works, e.g.:

```bash
npx serve .
```

## License

[MIT](LICENSE)
