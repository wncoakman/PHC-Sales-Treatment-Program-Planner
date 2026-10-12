// Minimal zip writer for the report export. Files are stored uncompressed: the PDF and JPEG photos are already
// compressed, so deflating them would gain almost nothing. Pure (tested); works in the browser and Node.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const dosTime = (d) => (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
const dosDate = (d) => ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

/** files: [{ name: "folder/file.pdf", data: Uint8Array }] → the zip file's bytes. Names are UTF-8. */
export function makeZip(files, date = new Date()) {
  const enc = new TextEncoder();
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data);
    const head = (sig, extra) => {
      const b = new DataView(new ArrayBuffer(extra));
      b.setUint32(0, sig, true);
      return b;
    };
    // Local file header (30 bytes + name).
    const l = head(0x04034b50, 30);
    l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true); l.setUint16(8, 0, true); // version, UTF-8 flag, stored
    l.setUint16(10, dosTime(date), true); l.setUint16(12, dosDate(date), true);
    l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true);
    l.setUint16(26, name.length, true); l.setUint16(28, 0, true);
    locals.push(new Uint8Array(l.buffer), name, data);
    // Central directory entry (46 bytes + name).
    const c = head(0x02014b50, 46);
    c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dosTime(date), true); c.setUint16(14, dosDate(date), true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    centrals.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = centrals.reduce((s, b) => s + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((s, b) => s + b.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
