/**
 * A REAL .xlsx FILE, written by hand.
 *
 * An .xlsx is a zip of a few XML files: a list of tabs, one file per tab, and a style
 * table. Writing those directly takes a page of code and one small zip library
 * (fflate, plain JavaScript, so it ships in an over-the-air update). The usual
 * spreadsheet library would add far more than this needs, and its npm release has
 * not been updated in years.
 *
 * Text is written inline in each cell rather than in a shared string table: slightly
 * bigger files, much simpler code, and Excel, Google Sheets and openpyxl all read it.
 *
 * Imports nothing of ours, so tests/fieldwork.test.ts runs it with `node --test`.
 */
import { strToU8, zipSync } from 'fflate';


/* The same shapes as SheetRows in model.ts, restated so this file imports nothing of ours. */
export type Cell = string | number | null;
export type Mark = 'changed' | 'added' | null;

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type Tab = { name: string; header: string[]; rows: Cell[][]; marks: Mark[][]; widths?: number[] };

/* Style ids in styles.xml below: 0 plain, 1 header, 2 changed (yellow), 3 added (green). */
const STYLE: Record<Exclude<Mark, null> | 'header' | 'plain', number> = { plain: 0, header: 1, changed: 2, added: 3 };

/** XML-safe text. Control characters other than tab and line breaks are not allowed in XML at all. */
function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 0 -> A, 25 -> Z, 26 -> AA. */
function colName(i: number): string {
  let n = i + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function cellXml(value: Cell, ref: string, style: number): string {
  const s = style ? ` s="${style}"` : '';
  if (value === null || value === '') return style ? `<c r="${ref}"${s}/>` : '';
  if (typeof value === 'number') return `<c r="${ref}"${s}><v>${value}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function sheetXml(tab: Tab): string {
  const rows = [tab.header as Cell[], ...tab.rows];
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          const style = r === 0 ? STYLE.header : STYLE[tab.marks[r - 1]?.[c] ?? 'plain'];
          return cellXml(v, `${colName(c)}${r + 1}`, style);
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  const cols = tab.widths
    ? `<cols>${tab.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  /* The header row stays in view while scrolling. */
  const freeze =
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `${freeze}${cols}<sheetData>${body}</sheetData></worksheet>`
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="5">' +
  '<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE7E1D8"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFFFE58A"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFC9EBD3"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

/** The tabs, zipped into an .xlsx file's bytes. */
export function writeXlsx(tabs: Tab[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        tabs
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets>${tabs.map((t, i) => `<sheet name="${esc(t.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
        '</workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        tabs
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${tabs.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(STYLES_XML),
  };
  tabs.forEach((t, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(t));
  });
  return zipSync(files, { level: 6 });
}

/** Column widths for the survey export's three tabs, in characters. */
export const SURVEY_WIDTHS = {
  newShops: [30, 40, 12, 12, 24, 26, 30, 24, 14, 18, 8, 30, 17],
  editedShops: [12, 30, 40, 12, 12, 24, 26, 30, 24, 14, 18, 30, 60],
  changes: [17, 12, 30, 20, 40, 40],
};
