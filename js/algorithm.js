/*
 * Seating arrangement core — pure logic, no DOM access.
 * Exposed as window.Seating (plain scripts, not ES modules, so index.html
 * keeps working when opened directly from the filesystem).
 */
"use strict";
(function () {

    /**
     * Parse CSV text into students.
     * Expected line format: "Registration No, Section".
     * Blank lines are skipped; an optional header row on the first line is
     * detected and skipped. Malformed lines are reported, not fatal.
     */
    function parseCSV(text) {
        const lines = String(text).split(/\r\n|\r|\n/);
        const students = [];
        const errors = [];
        let firstDataLine = true;

        for (let idx = 0; idx < lines.length; idx++) {
            const raw = lines[idx].trim();
            if (!raw) continue;

            const parts = raw.split(",").map(p => p.trim().replace(/^"(.*)"$/, "$1").trim());
            const rollNo = parts[0] || "";
            const section = parts[1] || "";

            if (firstDataLine) {
                firstDataLine = false;
                const looksLikeHeader =
                    /^(reg|roll|student|id)/i.test(rollNo) && /^(sec|class|group)/i.test(section);
                if (looksLikeHeader) continue;
            }

            if (!rollNo || !section) {
                errors.push('Line ' + (idx + 1) + ': expected "Registration No, Section" — got "' + raw + '"');
                continue;
            }
            students.push({ rollNo: rollNo, section: section });
        }
        return { students: students, errors: errors };
    }

    /** Group students into a Map of section name -> array of students (CSV order). */
    function groupBySection(students) {
        const map = new Map();
        for (const s of students) {
            if (!map.has(s.section)) map.set(s.section, []);
            map.get(s.section).push(s);
        }
        return map;
    }

    /**
     * Arrange students into rooms so that no two students of the same section
     * are adjacent — front-back (same column) or left-right (same row in
     * neighbouring columns). Seats fill column-major: column 1 top to bottom,
     * then column 2, and so on; a new room starts when one fills up.
     *
     * Greedy pick: at every seat, take the eligible section with the most
     * students remaining (largest-first interleaving dead-ends far less often
     * than plain round-robin).
     *
     * When no section is eligible (dead end), `config.strategy` decides:
     *   "spaces" — leave the seat empty and continue (always terminates:
     *              an empty neighbour blocks nothing);
     *   "as-is"  — seat the largest remaining section anyway and mark the
     *              seat as a conflict.
     *
     * @param students array of { rollNo, section }
     * @param config   { columns, rows, strategy: "spaces" | "as-is" }
     * @returns { seats, sections, config, stats }
     */
    function arrangeSeating(students, config) {
        const columns = Math.max(1, config.columns | 0);
        const rows = Math.max(1, config.rows | 0);
        const capacity = columns * rows;
        const strategy = config.strategy === "as-is" ? "as-is" : "spaces";

        const groups = [];
        groupBySection(students).forEach(function (list, section) {
            groups.push({ section: section, queue: list.slice() });
        });
        const sections = groups.map(g => ({ name: g.section, count: g.queue.length }));

        const seats = [];
        let remaining = students.length;
        let emptySeats = 0;
        let conflicts = 0;

        // Can `section` take the next seat? Neighbours are derived from
        // room-local coordinates, so constraints never leak across rooms.
        // Checked: front (same column), left (same row) and both left-hand
        // diagonals — the right-hand side is still unfilled, and the relation
        // is symmetric, so the finished plan has no same-section pair in any
        // of the 8 surrounding seats.
        function seatOk(section) {
            const i = seats.length;
            const inRoom = i % capacity;
            const row = inRoom % rows;
            if (row !== 0) {                           // not at the top of a column
                if (seats[i - 1].section === section) return false;        // front-back
            }
            if (inRoom >= rows) {                      // not in the room's first column
                if (seats[i - rows].section === section) return false;     // left-right
                if (row !== 0 &&
                    seats[i - rows - 1].section === section) return false; // diagonal up-left
                if (row !== rows - 1 &&
                    seats[i - rows + 1].section === section) return false; // diagonal down-left
            }
            return true;
        }

        function pushSeat(student, conflict) {
            const i = seats.length;
            const inRoom = i % capacity;
            seats.push({
                rollNo: student ? student.rollNo : "",
                section: student ? student.section : "",
                empty: !student,
                conflict: !!conflict,
                room: Math.floor(i / capacity) + 1,
                seatNo: inRoom + 1,
                column: Math.floor(inRoom / rows) + 1,
                row: (inRoom % rows) + 1
            });
        }

        while (remaining > 0) {
            groups.sort((a, b) => b.queue.length - a.queue.length);
            let picked = null;
            for (const g of groups) {
                if (g.queue.length > 0 && seatOk(g.section)) {
                    picked = g;
                    break;
                }
            }
            if (picked) {
                pushSeat(picked.queue.shift(), false);
                remaining--;
            } else if (strategy === "spaces") {
                pushSeat(null, false);
                emptySeats++;
            } else {
                const g = groups.find(x => x.queue.length > 0);
                pushSeat(g.queue.shift(), true);
                conflicts++;
                remaining--;
            }
        }

        return {
            seats: seats,
            sections: sections,
            config: { columns: columns, rows: rows, capacity: capacity, strategy: strategy },
            stats: {
                students: students.length,
                sections: sections.length,
                rooms: Math.ceil(seats.length / capacity),
                seatsUsed: seats.length,
                emptySeats: emptySeats,
                conflicts: conflicts
            }
        };
    }

    window.Seating = {
        parseCSV: parseCSV,
        groupBySection: groupBySection,
        arrangeSeating: arrangeSeating
    };
})();
