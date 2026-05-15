/**
 * @file mii-db-parser.js
 * Obtained from: https://github.com/ariankordi/my-jsfiddles/blob/main/mii-db-parser/script.js
 * Reads Wii, 3DS, Wii U, and Switch Mii databases,
 * displaying icons and names of every character within.
 *
 * TODO: Does NOT read hidden databases ("Mii Parade").
 * This was originally made to read FFL_ODB.dat in NWF,
 * and TODO that functionality was broken during conversion to ES6.
 * @author Arian Kordi <https://github.com/ariankordi>
 */
// @ts-check

/* eslint @stylistic/indent: ['error', 2] -- Define indent rules. */

/* eslint unicorn/prefer-dom-node-append: 'off' -- Incompatible with ES5 browsers.  */
/* eslint unicorn/prefer-blob-reading-methods: 'off' -- Incompatible with ES5 browsers. */
/* eslint unicorn/prefer-add-event-listener: 'off' -- Not sure */

/* eslint jsdoc/require-param: 'off' -- do not care. */
/* eslint jsdoc/require-returns: 'off' -- do not care. */

// // ---------------------------------------------------------------------
// //  Utilities: CRC-16/CCITT, Base64, UTF-16, "is all zeroes"
// // ---------------------------------------------------------------------

/**
 * Calculates the CRC-16/CCITT checksum for the specified input data.
 * Courtesy of Luciano Barcaro: https://stackoverflow.com/a/30357446
 */
function crc16(/** @type {Uint8Array} */ src, /** @type {number} */ size) {
  /** Starting CRC value. */ const crc = 0;

  /** Most significant byte. */ let msb = crc >> 8;
  /** Least significant byte. */ let lsb = crc & 0xFF;

  for (let i = 0; i < size; i++) {
    // XOR the byte value with the current MSB.
    let x = src[i] ^ msb;
    x ^= (x >> 4); // XOR with its right-shifted value by 4 bits.

    msb = (lsb ^ (x >> 3) ^ (x << 4)) & 0xFF;
    lsb = (x ^ (x << 5)) & 0xFF;
  }

  // Combine the two bytes into one 16-bit value.
  return (msb << 8) | lsb;
}

/** Convert Uint8Array to a Base64 string. */
function bytesToBase64(/** @type {Uint8Array} */ bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Convert a wide 16-bit string (UTF-16) to a native string. */
function decodeChar16(/** @type {Uint8Array} */ data, /** @type {number} */ offset,
  /** @type {number} */ length, /** @type {boolean} */ le = true) {
  const view = new DataView(data.buffer,
    data.byteOffset + offset, length * 2);
  let name = '';
  /** @type {number} */ let char;
  for (let i = 0; i < length && // check null termination
    (char = view.getUint16(i * 2, le)) !== 0; i++) {
    name += String.fromCharCode(char);
  }
  return name;
}

/** Whether or not all elements of the input array are equal to zero. */
function areAllZeros(/** @type {ArrayLike<number>} */ d) {
  for (let i = 0; i < d.length; i++) {
    if (d[i] !== 0) {
      return false;
    }
  }
  return true;
}

class EndianSwapUtility {
  /** @private */ static swap16All(/** @type {Uint8Array} */ data,
    /** @type {number} */ offset, /** @type {number} */ count = 1) {
    for (let i = 0; i < count; i++) {
      const idx = i * 2;
      const b0 = data[offset + idx];
      const b1 = data[offset + idx + 1];
      data[offset + idx] = b1;
      data[offset + idx + 1] = b0;
    }
  }

  /** @private */ static swap32(/** @type {Uint8Array} */ data,
    /** @type {number} */ offset) {
    const b0 = data[offset];
    const b1 = data[offset + 1];
    const b2 = data[offset + 2];
    const b3 = data[offset + 3];
    data[offset] = b3;
    data[offset + 1] = b2;
    data[offset + 2] = b1;
    data[offset + 3] = b0;
  }

  static swapVer3MiiData(/** @type {Uint8Array} */ data,
    /** @type {boolean} */ hasCreator) {
    // Reference: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/src/FFLiMiiDataCore.cpp#L6-L14
    EndianSwapUtility.swap32(data, 0);
    // authorID (8) + createID (10) + reserved (2) = 20 byte skip
    // gender, birthDate, favoriteColor, name
    EndianSwapUtility.swap16All(data, 24, 11);
    // reserved (2) + (11 * 2) = 24 byte skip
    EndianSwapUtility.swap16All(data, 48, 12); // uh
    if (hasCreator) { // not for core data
      EndianSwapUtility.swap16All(data, 72, 10); // creatorName
    }
  }
}

// // ---------------------------------------------------------------------
// //  Mii data utilities
// // ---------------------------------------------------------------------

class CharDataUtility {
  /** Converts 92-byte 3DS/Wii U Mii data to 96-byte "Ver3StoreData", adding the CRC-16. */
  static ver3OfficialToStore(/** @type {Uint8Array} */ dst, /** @type {Uint8Array} */ src) {
    console.assert(dst.length === 96, 'expected destination array to be Ver3StoreData length');
    dst.set(src);
    const crc = crc16(dst, 94);
    const dv = new DataView(dst.buffer);
    dv.setUint16(94, crc, false);
    return dst;
  }

  /**
   * Gets the nickname from a supported Mii data format.
   * @throws {Error} Throws if the data format is unknown.
   */
  static getName(/** @type {Uint8Array} */ data, /** @type {number} */ size) {
    switch (size) {
      case 76:
      case 74: // RFLCharData
        return decodeChar16(data, 2, 10, /* littleEndian= */ false);
      case 72:
      case 96:
      case 92: // FFLiMiiDataOfficial
        return decodeChar16(data, 0x1A, 10, /* littleEndian= */ true);
      case 48:
      case 68: // nn::mii::detail::StoreDataRaw
        return decodeChar16(data, 0x1C, 10, /* littleEndian= */ true);
      case 88: // nn::mii::detail::CharInfoRaw
        return decodeChar16(data, 0x10, 10, /* littleEndian= */ true);
      default:
        throw new Error('unexpected character data length');
    }
  }
}

// // ---------------------------------------------------------------------
// //  Mii database classes
// // ---------------------------------------------------------------------

/**
 * @typedef {Object} MiiDatabaseOfficial
 * @property {function(): number} getFileSize
 * @property {function(): number} getDataSize
 * @property {function(): number} getDataNum
 * @property {function(): boolean} isLittleEndian
 * @property {function(): number} getCrcOffset
 * @property {function(number): number} getOffset
 * @property {function(Uint8Array): boolean} isDataEmpty
 */

/**
 * Database header for Wii (RFL_DB.dat).
 * @todo Also contains hidden DB.
 */
class MiiDatabaseOfficialRfl {
  static getFileSize() {
    return 779968;
  }

  static getDataSize() {
    return 0x4A;
  }

  static getDataNum() {
    return 100;
  }

  static getCrcOffset() {
    return 0x1f1de;
  }

  static isLittleEndian() {
    return false;
  }

  /** gets the index of the character data */
  static getOffset(/** @type {number} */ index) {
    return 4 + (index * 0x4A);
  }

  /** checks if the character data entry is empty/invalid */
  static isDataEmpty(/** @type {Uint8Array} */ data) {
    const createId = data.subarray(24, 32);
    return areAllZeros(createId);
  }
}

/**
 * Database header for 3DS (CFL_DB.dat).
 * @todo Also contains hidden DB.
 */
class MiiDatabaseOfficialCtr {
  static getFileSize() {
    return 310560;
  }

  static getDataSize() {
    return 0x5C;
  }

  static getDataNum() {
    return 100;
  }

  static getCrcOffset() {
    return 0xc81e;
  }

  static isLittleEndian() {
    return true;
  }

  /** gets the index of the character data */
  static getOffset(/** @type {number} */ index) {
    // GetImpl__24FFLiDatabaseFileOfficialCFUs
    return 8 + (index * 0x5C);
  }

  /** checks if the character data entry is empty/invalid */
  static isDataEmpty(/** @type {Uint8Array} */ data) {
    const createId = data.subarray(12, 22);
    return areAllZeros(createId);
  }
}

/**
 * Database header for Wii U (FFL_ODB.dat).
 * @todo Hidden DB is in separate file (FFL_HDB.dat).
 */
class MiiDatabaseOfficialCafe {
  static getFileSize() {
    return 276544;
  }

  static getDataSize() {
    return 0x5c;
  }

  static getDataNum() {
    return 3000;
  }

  static getCrcOffset() {
    return 0x4383e;
  }

  static isLittleEndian() {
    return false;
  }

  /** gets the index of the character data */
  static getOffset(/** @type {number} */ index) {
    // GetImpl__24FFLiDatabaseFileOfficialCFUs
    return 8 + (index * 0x5c);
  }

  /** checks if the character data entry is empty/invalid */
  static isDataEmpty(/** @type {Uint8Array} */ data) {
    const createId = data.subarray(12, 22);
    return areAllZeros(createId);
  }
}

/** Database header for Switch (MiiDatabase.dat) */
class MiiDatabaseNx {
  static getFileSize() {
    return 6808;
  }

  static getDataSize() {
    return 68;
  }

  static getDataNum() {
    return 100;
  }

  static getCrcOffset() {
    return 0x1a96;
  }

  static isLittleEndian() {
    return true;
  }

  /** gets the index of the character data */
  static getOffset(/** @type {number} */ index) {
    return 4 + (index * 68);
  }

  /** checks if the character data entry is empty/invalid */
  static isDataEmpty(/** @type {Uint8Array} */ data) {
    const createId = data.subarray(0x30, 0x40);
    return areAllZeros(createId);
  }
}

class MiiDatabaseAccessor {
  constructor(/** @type {MiiDatabaseOfficial} */ db, /** @type {Uint8Array} */ dataArray) {
    /** @private */ this._db = db;
    /** @private */ this._dataArray = dataArray;

    if (dataArray.length !== db.getFileSize()) {
      throw new Error('MiiDatabaseAccessor: wrong file size');
    }
  }

  /**
   * determines type of database file
   * @param {Uint8Array} bytes - database file contents
   * @returns {MiiDatabaseOfficial} database header class
   * @throws {Error} throws if the input is invalid or magic is not recognized
   */
  static getType(bytes) {
    // Ensure we can safely read the first 4 bytes.
    if (!(bytes instanceof Uint8Array) || bytes.length < 4) {
      throw new Error('expected Uint8Array with at least 4 bytes');
    }

    // eslint-disable-next-line one-var -- Extract first four bytes as constants.
    const a = bytes[0], b = bytes[1], c = bytes[2], d = bytes[3];

    // RNOD: RVL Nigaoe Official Database
    if (a === 0x52 && b === 0x4E && c === 0x4F && d === 0x44) {
      return MiiDatabaseOfficialRfl;
    }
    // CFOF: CTR Face Official (prototype)
    if (a === 0x43 && b === 0x46 && c === 0x4F && d === 0x46) {
      throw new Error('does not support mid-2010 CFL_DB.dat sorry');
    }
    // CFOG: CTR Face Official but they changed F -> G
    if (a === 0x43 && b === 0x46 && c === 0x4F && d === 0x47) {
      return MiiDatabaseOfficialCtr;
    }
    // FFOC: Ca(f)e Face Official... Cafe???
    if (a === 0x46 && b === 0x46 && c === 0x4F && d === 0x43) {
      return MiiDatabaseOfficialCafe;
    }
    // NFDB: NintendoSDK Face (Library) Database
    if (a === 0x4E && b === 0x46 && c === 0x44 && d === 0x42) {
      return MiiDatabaseNx;
    }
    // NFIF: NintendoSDK Face (Library) Import File
    if (a === 0x4E && b === 0x46 && c === 0x49 && d === 0x46) {
      throw new Error('nx NFIF file is not supported at this time');
    }

    throw new Error('unknown magic for db');
  }

  isValid() {
    const offset = this._db.getCrcOffset();
    const result = crc16(this._dataArray, offset + /* sizeof(uint16_t) */ 2);
    // If the result is 0, all of the content before
    // the checksum exactly matches the checksum following.
    return result === 0;
  }

  getCharData(/** @type {number} */ index) {
    const begin = this._db.getOffset(index);
    const end = this._db.getOffset(index + 1);
    return this._dataArray.subarray(begin, end);
  }

  getNonEmptyNum() {
    let num = 0;
    for (let i = 0; i < this._db.getDataNum(); i++) {
      const data = this.getCharData(i);
      if (!this._db.isDataEmpty(data)) {
        num += 1;
      }
    }
    return num;
  }

  getCharDataAll() {
    const num = this._db.getDataNum();
    /** @type {Array<Uint8Array>} */
    const out = Array.from({ length: num });
    let current = 0;
    for (let i = 0; i < num; i++) {
      const data = this.getCharData(current);
      if (!this._db.isDataEmpty(data)) {
        out[current++] = data;
      }
    }
    return out;
  }
}

/**
 * Array of character data.
 * @typedef {{dataArray: Array<Uint8Array>,
 * characterNames: Array<string|null>,
 * nonEmptyNum: number}} CharDataArray
 */

/**
 * Process the uploaded database file and display Mii data.
 * @param {Uint8Array} uint8Array - The file data.
 * @returns {CharDataArray} An array of data from the FFL_ODB.
 * @throws {Error} Throws if database file is invalid.
 */
function getCharDataArrayFromDatabase(uint8Array) {
  // Get the database type and create the accessor.
  const db = MiiDatabaseAccessor.getType(uint8Array);
  const database = new MiiDatabaseAccessor(db, uint8Array);

  if (!database.isValid()) {
    throw new Error('Database CRC-16 is invalid.');
  }

  const nonEmptyNum = database.getNonEmptyNum();
  const dataArray = database.getCharDataAll();
  const characterNames = Array.from({ length: nonEmptyNum });

  const dataSize = db.getDataSize();
  const sizeVer3 = MiiDatabaseOfficialCafe.getDataSize();
  const shouldSwapVer3 = dataSize === sizeVer3 && !db.isLittleEndian();
  for (let i = 0; i < nonEmptyNum; i++) {
    if (shouldSwapVer3) { // Perform endian swapping.
      EndianSwapUtility.swapVer3MiiData(dataArray[i], /* hasCreator = */ true);
    }
    if (dataSize === sizeVer3) { // Specifically convert 3DS/Wii U Mii data to StoreData.
      dataArray[i] = CharDataUtility.ver3OfficialToStore(new Uint8Array(96), dataArray[i]);
    }
    // Decode UTF-16 name.
    characterNames[i] = CharDataUtility.getName(dataArray[i], dataSize);
  }

  return {
    dataArray,
    characterNames,
    nonEmptyNum
  };
}

/** Gets the text of the image element to be used in {@link displayCharDataArray}. */
function getImgElement(/** @type {string} */ b64Data, /** @type {string} */ width) {
  const d = encodeURIComponent(b64Data);
  return '<img src="https://mii-unsecure.ariankordi.net/miis/image.png?width=' + width + '&data=' + d + '" loading="lazy" width="' + width + '" height="' + width + '"><br>';
}

/**
 * Display the list of Mii Base64 strings in the HTML.
 * @param {CharDataArray} list - Array of Mii objects.
 */
function displayCharDataArray(/** @type {CharDataArray} */ list,
  /** @type {HTMLElement} */ ul) {
  ul.innerHTML = ''; // Clear existing content.

  for (let i = 0; i < list.nonEmptyNum; i++) {
    const name = list.characterNames[i];
    const data = list.dataArray[i];

    const li = document.createElement('li');
    const div = document.createElement('div');
    div.textContent = name;
    li.appendChild(div);

    // Encode data to Base64 and put it in a code block.
    const base64Data = bytesToBase64(data);
    const codeBlock = document.createElement('code');
    codeBlock.textContent = base64Data;
    li.appendChild(codeBlock);

    // Add inner bullet with image.
    const innerUl = document.createElement('ul');
    const innerLi = document.createElement('li');
    const imgWidth = 96;
    innerLi.innerHTML = getImgElement(base64Data, String(imgWidth));
    innerUl.appendChild(innerLi);
    li.appendChild(innerUl);

    ul.appendChild(li);
  }

  // Inform the user if no valid data was found.
  if (list.nonEmptyNum <= 0) {
    const notFound = document.createElement('li');
    notFound.textContent = 'No valid Mii data found.';
    ul.appendChild(notFound);
  }
}

/**
 * Handle the file input change event.
 * @param {Event} event - The change event.
 */
function handleFileSelect(event) {
  const target = /** @type {HTMLInputElement} */ (event.target);
  if (!target || !target.files || !target.files[0]) {
    alert('No file selected.');
    return;
  }

  const file = target.files[0];

  const reader = new FileReader();

  reader.onload = function (e) {
    const arrayBuffer = /** @type {FileReader} */ (e.target).result;
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      console.error('handleFileSelect / reader.onload: FileReader.result is not ArrayBuffer.');
      return;
    }

    let storeData;
    let ul;
    try {
      storeData = getCharDataArrayFromDatabase(new Uint8Array(arrayBuffer));
      ul = document.getElementById('miiList');
      if (!ul) {
        throw new Error('miiList element is missing.');
      }
    } catch (e) {
      alert(e);
      throw e;
    }
    displayCharDataArray(storeData, ul);
  };

  reader.onerror = function () {
    alert('handleFileSelect / reader.onerror: Error reading file.');
  };

  // Read the file as ArrayBuffer for binary processing
  reader.readAsArrayBuffer(file);
}

// // ---------------------------------------------------------------------
// //  NWF file reading implementation.
// //  TODO from 2026-05: NWF was probably broken from ES6 conversion
// // ---------------------------------------------------------------------

/**
 * Usually, you can't read system files in NWF (Nintendo Web Framework).
 * However, FFL_ODB is meant to be read by any other title, and
 * by patching jsextension_ext-fileio.rpl and, IIRC, replacing
 * a prefix like "/vol/aoc/" to just "/vol/", this bypasses its filter.
 */

// eslint-disable-next-line unicorn/prefer-global-this -- only works in nwf
if ('nwf' in window) {
  /** NWF File Reading Implementation */
  function onDatabaseReadNwf(/** @type {Event & {data: Blob}} */ evt) {
    // Check if evt.data is a Blob
    if (!evt.data) {
      alert('onDatabaseRead: evt.data is null or undefined.');
      return;
    }

    /** Define the Blob from the event. */
    const blob = evt.data;
    const reader = new FileReader();

    reader.onloadend = function () {
      if (!reader.result) {
        alert('onDatabaseRead: reader.result is null or undefined, failed to read Blob content.');
        return;
      }
      // Convert text content to an ArrayBuffer
      /** Result of the reader, which is expected to be a string. */
      const textData = reader.result;
      if (typeof textData !== 'string') {
        alert('onDatabaseRead / reader.onloadend: FileReader.result type is unexpectedly not string');
        return;
      }
      const bytes = new Uint8Array(textData.split('').map(
        /**
         * @param {string} char - The character as a string.
         * @returns {number} The byte index of the character.
         */
        function (char) {
          return char.charCodeAt(0);
        }));

      let storeData;
      let ul;
      try {
        storeData = getCharDataArrayFromDatabase(bytes);
        ul = document.getElementById('miiList');
        if (!ul) {
          throw new Error('miiList element is missing.');
        }
      } catch (e) {
        alert(e);
        throw e;
      }
      displayCharDataArray(storeData, ul);
    };

    reader.onerror = function () {
      alert('onDatabaseRead / reader.onerror: Could not read Blob.');
    };

    // Read the Blob as text
    reader.readAsBinaryString(blob); // Use binary string to match expected content format
  }

  /** Database read failure handler for NWF. */
  function onDatabaseReadFailNwf() {
    alert('nwf.events.IOEvent.ERROR / Failed to read FFL_ODB.dat file.');
  }
  // Initialize NWF file reading on document ready.
  document.addEventListener('DOMContentLoaded', function () {
    try {
      // TODO: Path is different for JP/EU.
      const directory = new nwf.io.Directory('/vol/storage_mlc01/usr/save/00050010/1004a100/user/common/db/');
      const files = directory.listFiles();

      for (let i = 0; i < files.length; i++) {
        if (files[i].fileName === 'FFL_ODB' && files[i].fileExtension === 'dat') {
          const file = new nwf.io.File('FFL_ODB.dat', directory);
          file.addEventListener(nwf.events.IOEvent.READ_COMPLETE, onDatabaseReadNwf);
          file.addEventListener(nwf.events.IOEvent.ERROR, onDatabaseReadFailNwf);
          file.read();
          break;
        }
      }
    } catch (error) {
      alert('An error occurred while accessing the directory: ' + error.message);
    }
  });
}

// Polyfill for btoa (base64 encoding) if not available.
// https://github.com/MaxArt2501/base64-js/blob/master/base64.js
if (typeof btoa === 'undefined') {
  // base64 character set, plus padding character (=)
  const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  // eslint-disable-next-line unicorn/prefer-global-this -- for old browsers
  window.btoa = function (/** @type {string} */ s) {
    /** Final padding count. */ const rest = s.length % 3;
    let result = '';
    for (let i = 0; i < s.length; i += 3) {
      // range check for Latin1 removed
      const bitmap = (s.charCodeAt(i) << 16) |
        (s.charCodeAt(i + 1) << 8) | s.charCodeAt(i + 2);
      result += b64.charAt(bitmap >> 18 & 63) + b64.charAt(bitmap >> 12 & 63) +
        b64.charAt(bitmap >> 6 & 63) + b64.charAt(bitmap & 63);
    }

    // If there's need of padding, replace the last 'A's with equal signs.
    // eslint-disable-next-line unicorn/prefer-string-slice -- for safari 5
    return rest ? result.slice(0, rest - 3) + '==='.substring(rest) : result;
  };
}

// Attach event listeners.
document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.getElementById('fileInput');
  if (fileInput && fileInput.addEventListener) {
    fileInput.addEventListener('change', handleFileSelect, false);
  } else {
    alert('Could not find element fileInput.');
  }
});

// Export for the inline HTML in the jsfiddle that. is supposed to load a file.
if (typeof globalThis !== 'undefined') {
  globalThis['getCharDataArrayFromDatabase'] = getCharDataArrayFromDatabase;
  globalThis['displayCharDataArray'] = displayCharDataArray;
}

export {
  getCharDataArrayFromDatabase,
  MiiDatabaseAccessor,
  MiiDatabaseOfficialRfl,
  MiiDatabaseOfficialCtr,
  MiiDatabaseOfficialCafe,
  MiiDatabaseNx,
  // misc.
  decodeChar16,
  crc16,
  EndianSwapUtility,
  CharDataUtility
};
