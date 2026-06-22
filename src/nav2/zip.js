/**
 * Minimal, dependency-free ZIP writer (store / no compression).
 * Enough to bundle a few text files for download. Not a general ZIP library.
 */

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function pushU16(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF); }
function pushU32(arr, v) { arr.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); }

/**
 * @param {Array<{name:string, content:(string|Uint8Array)}>} files
 * @returns {Blob} application/zip
 */
export function makeZip(files) {
    const enc = new TextEncoder();
    const chunks = [];          // Uint8Array pieces for the final blob
    const central = [];         // central directory bytes
    let offset = 0;

    for (const f of files) {
        const nameBytes = enc.encode(f.name);
        const data = (f.content instanceof Uint8Array) ? f.content : enc.encode(f.content);
        const crc = crc32(data);

        // Local file header
        const local = [];
        pushU32(local, 0x04034b50);
        pushU16(local, 20);            // version needed
        pushU16(local, 0);             // flags
        pushU16(local, 0);             // method: store
        pushU16(local, 0);             // mod time
        pushU16(local, 0);             // mod date
        pushU32(local, crc);
        pushU32(local, data.length);   // compressed size
        pushU32(local, data.length);   // uncompressed size
        pushU16(local, nameBytes.length);
        pushU16(local, 0);             // extra len
        const localHeader = new Uint8Array(local);

        chunks.push(localHeader, nameBytes, data);
        const localStart = offset;
        offset += localHeader.length + nameBytes.length + data.length;

        // Central directory entry
        pushU32(central, 0x02014b50);
        pushU16(central, 20);          // version made by
        pushU16(central, 20);          // version needed
        pushU16(central, 0);           // flags
        pushU16(central, 0);           // method
        pushU16(central, 0);           // time
        pushU16(central, 0);           // date
        pushU32(central, crc);
        pushU32(central, data.length);
        pushU32(central, data.length);
        pushU16(central, nameBytes.length);
        pushU16(central, 0);           // extra len
        pushU16(central, 0);           // comment len
        pushU16(central, 0);           // disk number
        pushU16(central, 0);           // internal attrs
        pushU32(central, 0);           // external attrs
        pushU32(central, localStart);  // local header offset
        for (const b of nameBytes) central.push(b);
    }

    const centralBytes = new Uint8Array(central);
    const centralStart = offset;

    const end = [];
    pushU32(end, 0x06054b50);
    pushU16(end, 0);                   // disk
    pushU16(end, 0);                   // disk with central
    pushU16(end, files.length);        // entries on disk
    pushU16(end, files.length);        // total entries
    pushU32(end, centralBytes.length); // central size
    pushU32(end, centralStart);        // central offset
    pushU16(end, 0);                   // comment len

    return new Blob([...chunks, centralBytes, new Uint8Array(end)], { type: 'application/zip' });
}
