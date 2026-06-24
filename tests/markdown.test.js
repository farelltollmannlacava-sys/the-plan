const { test, expect } = require("bun:test");
const { mdToHtml } = require("../assets/markdown.js");

test("Überschriften: # ## ### -> h2 h3 h4", () => {
  expect(mdToHtml("# Titel")).toBe("<h2>Titel</h2>");
  expect(mdToHtml("## Welt")).toBe("<h3>Welt</h3>");
  expect(mdToHtml("### Supplements")).toBe("<h4>Supplements</h4>");
});

test("Liste: zusammenhängende - Zeilen werden eine ul", () => {
  expect(mdToHtml("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
});

test("Fett: **x** -> strong innerhalb p", () => {
  expect(mdToHtml("Heute **wichtig** ok")).toBe("<p>Heute <strong>wichtig</strong> ok</p>");
});

test("Absatz + Leerzeile beendet Liste", () => {
  expect(mdToHtml("- a\n\nText")).toBe("<ul><li>a</li></ul><p>Text</p>");
});

test("HTML wird escaped (kein XSS)", () => {
  expect(mdToHtml("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  expect(mdToHtml("a & b")).toBe("<p>a &amp; b</p>");
});

test("Märkte-Zeile mit | bleibt als Absatz erhalten", () => {
  expect(mdToHtml("DAX 24.500 | Gold 4.100 $")).toBe("<p>DAX 24.500 | Gold 4.100 $</p>");
});

test("Leere Eingabe -> leerer String", () => {
  expect(mdToHtml("")).toBe("");
});

test("Tabelle: Header + Separator + Zeilen -> table", () => {
  const md = "| Zeit | Block |\n|---|---|\n| 07:00 | ZOXS |\n| 08:00 | KI |";
  expect(mdToHtml(md)).toBe(
    "<table><thead><tr><th>Zeit</th><th>Block</th></tr></thead><tbody>" +
    "<tr><td>07:00</td><td>ZOXS</td></tr><tr><td>08:00</td><td>KI</td></tr></tbody></table>"
  );
});

test("Tabelle: Zellen werden escaped + fett geparst", () => {
  const md = "| A | B |\n|---|---|\n| **x** | <b> |";
  expect(mdToHtml(md)).toBe(
    "<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody>" +
    "<tr><td><strong>x</strong></td><td>&lt;b&gt;</td></tr></tbody></table>"
  );
});

test("Tabelle: Absatz danach bleibt erhalten", () => {
  const md = "| A |\n|---|\n| 1 |\n\nDanach";
  expect(mdToHtml(md)).toBe(
    "<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table><p>Danach</p>"
  );
});
