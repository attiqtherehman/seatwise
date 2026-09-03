/*
 * UI layer for the Seating Arrangement System.
 * All rendering uses createElement/textContent so CSV content is never
 * interpreted as HTML.
 */
"use strict";
(function () {
    const $ = id => document.getElementById(id);

    const state = {
        students: [],
        result: null,
        view: "room",
        colors: {}   // section name -> HSL hue
    };

    /* ---------- input ---------- */

    function handleCSVText(text, sourceName) {
        const parsed = Seating.parseCSV(text);
        state.students = parsed.students;
        state.result = null;
        renderParseErrors(parsed.errors);
        renderInputSummary(sourceName);
        $("configCard").hidden = state.students.length === 0;
        $("resultsCard").hidden = true;
    }

    function readFile(file) {
        if (!file) return;
        if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
            alert("Please choose a .csv file.");
            return;
        }
        const reader = new FileReader();
        reader.onload = e => handleCSVText(e.target.result, file.name);
        reader.onerror = () => alert("Could not read the file. Please try again.");
        reader.readAsText(file);
    }

    // Mirrors sample.csv in the repo root.
    function sampleCSV() {
        const counts = [["A", 40], ["B", 35], ["C", 30], ["D", 15]];
        const lines = ["Registration No,Section"];
        let n = 1;
        for (const [section, count] of counts) {
            for (let i = 0; i < count; i++) {
                lines.push("2019-CS-" + String(n++).padStart(3, "0") + "," + section);
            }
        }
        return lines.join("\n");
    }

    function renderParseErrors(errors) {
        const box = $("parseErrors");
        box.textContent = "";
        box.hidden = errors.length === 0;
        for (const msg of errors.slice(0, 10)) {
            const p = document.createElement("p");
            p.textContent = "⚠ " + msg;
            box.appendChild(p);
        }
        if (errors.length > 10) {
            const p = document.createElement("p");
            p.textContent = "… and " + (errors.length - 10) + " more line(s) skipped.";
            box.appendChild(p);
        }
    }

    function renderInputSummary(sourceName) {
        const box = $("inputSummary");
        box.textContent = "";
        box.hidden = false;
        if (state.students.length === 0) {
            const p = document.createElement("p");
            p.textContent = "No students found in " + (sourceName || "the file") + ".";
            box.appendChild(p);
            return;
        }
        const bySection = Seating.groupBySection(state.students);
        const line = document.createElement("p");
        line.className = "summary-line";
        line.textContent = "Loaded " + state.students.length + " students in " +
            bySection.size + " section(s) from " + (sourceName || "file") + ":";
        box.appendChild(line);
        const chips = document.createElement("div");
        chips.className = "chips";
        bySection.forEach(function (list, section) {
            const chip = document.createElement("span");
            chip.className = "chip";
            chip.textContent = "Section " + section + ": " + list.length;
            chips.appendChild(chip);
        });
        box.appendChild(chips);
    }

    /* ---------- generate ---------- */

    function currentConfig() {
        return {
            columns: parseInt($("columnsInput").value, 10) || 5,
            rows: parseInt($("rowsInput").value, 10) || 10,
            strategy: document.querySelector('input[name="strategy"]:checked').value
        };
    }

    function generate() {
        state.result = Seating.arrangeSeating(state.students, currentConfig());
        assignColors(state.result.sections);
        $("resultsCard").hidden = false;
        renderStats();
        renderLegend();
        renderOutput();
        $("resultsCard").scrollIntoView({ behavior: "smooth" });
    }

    function assignColors(sections) {
        state.colors = {};
        const step = 360 / Math.max(sections.length, 1);
        sections.forEach(function (s, idx) {
            state.colors[s.name] = Math.round(idx * step);
        });
    }

    function renderStats() {
        const s = state.result.stats;
        const box = $("statsRow");
        box.textContent = "";
        const items = [
            ["Students", s.students],
            ["Sections", s.sections],
            ["Rooms used", s.rooms],
            ["Room capacity", state.result.config.capacity]
        ];
        if (s.emptySeats > 0) items.push(["Empty seats", s.emptySeats]);
        for (const [label, value] of items) box.appendChild(statTile(label, value, false));
        if (s.conflicts > 0) box.appendChild(statTile("Adjacent conflicts", s.conflicts, true));
    }

    function statTile(label, value, warn) {
        const tile = document.createElement("div");
        tile.className = "stat" + (warn ? " stat-warn" : "");
        const v = document.createElement("div");
        v.className = "stat-value";
        v.textContent = value;
        const l = document.createElement("div");
        l.className = "stat-label";
        l.textContent = label;
        tile.appendChild(v);
        tile.appendChild(l);
        return tile;
    }

    function renderLegend() {
        const box = $("legend");
        box.textContent = "";
        for (const s of state.result.sections) {
            const chip = document.createElement("span");
            chip.className = "chip chip-colored";
            chip.style.setProperty("--hue", state.colors[s.name]);
            chip.textContent = "Section " + s.name + " (" + s.count + ")";
            box.appendChild(chip);
        }
        if (state.result.stats.emptySeats > 0) {
            const chip = document.createElement("span");
            chip.className = "chip chip-empty";
            chip.textContent = "empty seat";
            box.appendChild(chip);
        }
        if (state.result.stats.conflicts > 0) {
            const chip = document.createElement("span");
            chip.className = "chip chip-conflict";
            chip.textContent = "⚠ adjacent conflict";
            box.appendChild(chip);
        }
    }

    /* ---------- views ---------- */

    function setView(view) {
        state.view = view;
        renderOutput();
    }

    function renderOutput() {
        const out = $("output");
        out.textContent = "";
        out.classList.toggle("section-view", state.view === "section");
        if (!state.result) return;
        $("roomTab").classList.toggle("active", state.view === "room");
        $("sectionTab").classList.toggle("active", state.view === "section");
        $("roomTab").setAttribute("aria-selected", state.view === "room");
        $("sectionTab").setAttribute("aria-selected", state.view === "section");
        if (state.view === "room") renderRoomWise(out);
        else renderSectionWise(out);
    }

    function renderRoomWise(container) {
        const rooms = [];
        for (const seat of state.result.seats) {
            (rooms[seat.room - 1] = rooms[seat.room - 1] || []).push(seat);
        }
        rooms.forEach(function (seatsInRoom, idx) {
            const roomDiv = document.createElement("div");
            roomDiv.className = "room";
            const title = document.createElement("h3");
            title.textContent = "Room " + (idx + 1);
            roomDiv.appendChild(title);

            const cols = [];
            for (const seat of seatsInRoom) {
                (cols[seat.column - 1] = cols[seat.column - 1] || []).push(seat);
            }
            const scroll = document.createElement("div");
            scroll.className = "room-scroll";
            const grid = document.createElement("div");
            grid.className = "room-grid";
            cols.forEach(function (colSeats, cIdx) {
                const colDiv = document.createElement("div");
                colDiv.className = "room-col";
                const head = document.createElement("div");
                head.className = "col-head";
                head.textContent = "Column " + (cIdx + 1);
                colDiv.appendChild(head);
                for (const seat of colSeats) colDiv.appendChild(seatCell(seat));
                grid.appendChild(colDiv);
            });
            scroll.appendChild(grid);
            roomDiv.appendChild(scroll);
            container.appendChild(roomDiv);
        });
    }

    function seatCell(seat) {
        const cell = document.createElement("div");
        const no = document.createElement("span");
        no.className = "seat-no";
        no.textContent = seat.seatNo;
        cell.appendChild(no);

        if (seat.empty) {
            cell.className = "seat seat-empty";
            const txt = document.createElement("span");
            txt.className = "seat-roll";
            txt.textContent = "empty";
            cell.appendChild(txt);
            return cell;
        }

        cell.className = "seat seat-colored" + (seat.conflict ? " seat-conflict" : "");
        cell.style.setProperty("--hue", state.colors[seat.section]);
        const roll = document.createElement("span");
        roll.className = "seat-roll";
        roll.textContent = seat.rollNo;
        const sec = document.createElement("span");
        sec.className = "seat-sec";
        sec.textContent = "Sec " + seat.section + (seat.conflict ? " ⚠" : "");
        cell.appendChild(roll);
        cell.appendChild(sec);
        return cell;
    }

    function renderSectionWise(container) {
        const bySection = new Map();
        for (const seat of state.result.seats) {
            if (seat.empty) continue;
            if (!bySection.has(seat.section)) bySection.set(seat.section, []);
            bySection.get(seat.section).push(seat);
        }
        const names = Array.from(bySection.keys())
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        for (const section of names) {
            const block = document.createElement("div");
            block.className = "section-block";
            const title = document.createElement("h3");
            title.textContent = "Section " + section;
            title.style.setProperty("--hue", state.colors[section]);
            block.appendChild(title);

            const table = document.createElement("table");
            table.className = "section-table";
            const thead = document.createElement("thead");
            const headRow = document.createElement("tr");
            for (const label of ["Registration No", "Room", "Seat"]) {
                const th = document.createElement("th");
                th.textContent = label;
                headRow.appendChild(th);
            }
            thead.appendChild(headRow);
            table.appendChild(thead);

            const tbody = document.createElement("tbody");
            const seats = bySection.get(section).slice()
                .sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));
            for (const seat of seats) {
                const tr = document.createElement("tr");
                for (const value of [seat.rollNo, seat.room, seat.seatNo]) {
                    const td = document.createElement("td");
                    td.textContent = value;
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
            table.appendChild(tbody);
            block.appendChild(table);
            container.appendChild(block);
        }
    }

    /* ---------- export / print ---------- */

    function csvField(value) {
        const v = String(value);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }

    function downloadCSV() {
        if (!state.result) return;
        const lines = ["Room,Seat,Column,Row,Registration No,Section"];
        for (const seat of state.result.seats) {
            if (seat.empty) continue;
            lines.push([seat.room, seat.seatNo, seat.column, seat.row,
                csvField(seat.rollNo), csvField(seat.section)].join(","));
        }
        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const link = document.createElement("a");
        link.download = "seating-plan.csv";
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
    }

    /* ---------- wiring ---------- */

    $("csvFileInput").addEventListener("change", e => readFile(e.target.files[0]));
    $("loadSampleBtn").addEventListener("click", () => handleCSVText(sampleCSV(), "sample data"));

    const dropzone = $("dropzone");
    for (const ev of ["dragover", "dragenter"]) {
        dropzone.addEventListener(ev, function (e) {
            e.preventDefault();
            dropzone.classList.add("drag");
        });
    }
    for (const ev of ["dragleave", "drop"]) {
        dropzone.addEventListener(ev, function (e) {
            e.preventDefault();
            dropzone.classList.remove("drag");
        });
    }
    dropzone.addEventListener("drop", e => readFile(e.dataTransfer.files[0]));

    function updateCapacityNote() {
        const cfg = currentConfig();
        $("capacityNote").textContent = "Room capacity: " + (cfg.columns * cfg.rows) + " seats";
    }
    $("columnsInput").addEventListener("input", updateCapacityNote);
    $("rowsInput").addEventListener("input", updateCapacityNote);

    /* theme: dark by default, toggle persists the choice */
    const themeToggle = $("themeToggle");

    function currentTheme() {
        let stored = null;
        try { stored = localStorage.getItem("theme"); } catch (e) { /* storage unavailable */ }
        return stored === "light" ? "light" : "dark";
    }

    function refreshThemeToggle() {
        const dark = currentTheme() === "dark";
        themeToggle.textContent = dark ? "☀️" : "🌙";
        themeToggle.title = dark ? "Switch to light theme" : "Switch to dark theme";
    }

    themeToggle.addEventListener("click", function () {
        const next = currentTheme() === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem("theme", next); } catch (e) { /* storage unavailable */ }
        refreshThemeToggle();
    });
    refreshThemeToggle();

    $("generateBtn").addEventListener("click", generate);
    $("roomTab").addEventListener("click", () => setView("room"));
    $("sectionTab").addEventListener("click", () => setView("section"));
    $("downloadBtn").addEventListener("click", downloadCSV);
    $("printBtn").addEventListener("click", () => window.print());
})();
