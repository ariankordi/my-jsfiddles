// @ts-check

/* eslint @stylistic/indent: ['error', 2] -- Define indent rules. */
/* @stylistic/no-multi-spaces: 'off' -- Allow spaced comments. */

// // ---------------------------------------------------------------------
// //  AES Keys
// // ---------------------------------------------------------------------

/** @enum number */
const KeyType = {
  Production: 0,
  Development: 1,
  Null: 2
};
/**
 * AES keys at "Type 2, slot 0x31" in sjcl's representation.
 * https://www.3dbrew.org/wiki/PSPXI:EncryptDecryptAes#Key_Types
 * @type {Object<KeyType, sjcl.BitArray>}
 */
const AES_CCM_KEYSLOT_0x31_KEYS = {
  /** Production key. */
  [KeyType.Production]: sjcl.codec.hex.toBits('59FC817E6446EA6190347B20E9BDCE52'),
  /** Development key. */
  [KeyType.Development]: sjcl.codec.hex.toBits('12DF92B6FFD438AB291C4FD4D7CE256D'),
  /** Null key (used in Citra). */
  [KeyType.Null]: sjcl.codec.hex.toBits('00000000000000000000000000000000')
};

const AES_CTR_KEY_HEX = '30819F300D06092A864886F70D010101';

/** Reassigned to dev/prod. */
let gAESCCMKeyPrimary = AES_CCM_KEYSLOT_0x31_KEYS[KeyType.Production];

// @ts-ignore - HACK because jsfiddle blocks this word???
const crpyto = globalThis['crypt' + 'o'];
/**
 * Shortcut to SubtleCr*pto.
 * @todo NOTE: You may have to change this in your own setup.
 */
const sc = crpyto.subtle;
// ^^ Needed or else the fiddle will not save

// // ---------------------------------------------------------------------
// //  Utility Conversion
// // ---------------------------------------------------------------------

/** sizeof(CFLiWrappedMiiData) */
const WRAPPED_MII_DATA_LENGTH = 112;

/**
 * Converts a hexadecimal string to a Uint8Array.
 * @param {string} hex - The hexadecimal string.
 * @returns {Uint8Array} The converted Uint8Array.
 */
function hexToUint8Array(hex) {
  const match = hex.match(/.{1,2}/g);
  // If match returned null, use an empty array.
  const arr = (match ? match : []).map(function (byte) {
    return parseInt(byte, 16);
  });
  return new Uint8Array(arr);
}

/**
 * @param {Uint8Array} bytes - Input Uint8Array.
 * @returns {string} The data in hexadecimal.
 */
function uint8ArrayToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {string} base64 - The input Base64 string.
 * @returns {Uint8Array} The decoded data as Uint8Array.
 */
function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * @param {string} str - Input string to check.
 * @returns {boolean} Whether the string is valid hex.
 */
function isHex(str) {
  const hexRegex = /^[0-9A-Fa-f]+$/;
  return hexRegex.test(str);
}

/**
 * @param {string} str - Input string to check.
 * @returns {boolean} Whether the string is valid Base64.
 */
function isBase64(str) {
  try {
    atob(str); // `atob` will throw an error if the string is not valid base64
    return true;
  } catch {
    return false;
  }
}

// // ---------------------------------------------------------------------
// //  CRC-16 and CRC-32
// // ---------------------------------------------------------------------

/** Polynomial for CRC-16/CCITT. */
const CRC16_CCITT_POLY = 0x1021;
/**
 * Calculates a checksum of `data` using CRC-16/CCITT/XMODEM, with a polynomial of 0x1021.
 * @param {Uint8Array|Array<number>} data - The data to create a checksum of.
 * @returns {number} The CRC-16 checksum.
 */
function crc16(data) {
  let crc = 0xFFFF;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000)
        ? (crc << 1) ^ CRC16_CCITT_POLY
        : crc << 1;
    }
  }
  return crc & 0xFFFF;
}

/** Table for CRC-32 lookup. */
const crc32CksumTable = new Uint32Array(256);

/** Polynomial for CRC-32/POSIX/CKSUM. */
const CRC32_CKSUM_POLY = 0x04C11DB7;

/**
 * Function to generate a CRC-32/POSIX/CKSUM table.
 * @param {Uint32Array} table - The Uint32Array to populate with the table.
 * @param {number} [poly] - The polynomial to generate the CRC-32 table with.
 */
function generateCrc32Table(table, poly = CRC32_CKSUM_POLY) {
  for (let i = 0; i < 256; i++) {
    let crc = i << 24;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x80000000) {
        crc = (crc << 1) ^ poly;
      } else {
        crc = crc << 1;
      }
    }
    table[i] = crc >>> 0; // Ensure the value is an unsigned 32-bit integer
  }
}

generateCrc32Table(crc32CksumTable); // Generate the table.

/**
 * Calculates a checksum of `data` using CRC-32/POSIX/CKSUM.
 * @param {Uint8Array|Array<number>} input - The data to create a checksum of.
 * @param {Uint32Array} [table] - The CRC-32 table to use.
 * @returns {number} The CRC-32 checksum.
 */
function crc32(input, table = crc32CksumTable) {
  let crc = 0x00000000;
  for (let i = 0; i < input.length; i++) {
    const byte = (input[i] ^ (crc >>> 24)) & 0xFF;
    crc = (table[byte] ^ (crc << 8)) >>> 0;
  }
  // XOR with 0xFFFFFFFF at the end and ensure it's unsigned
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// // ---------------------------------------------------------------------
// //  AES-CCM Encryption
// // ---------------------------------------------------------------------

/**
 * Decrypts the AES-CCM portion of the QR code, using sjcl's private ctrMode function.
 * The default AES-CCM decryption function in sjcl does not work
 * due to the following errata: https://www.3dbrew.org/wiki/AES_Registers#CCM_mode_pitfall
 * @param {Uint8Array} encryptedData - Input QR code data (CFLiWrappedMiiData)
 * @param {Array<number>} [key] - The key to pass into sjcl.
 * @returns {Uint8Array} The encrypted StoreData.
 * @throws {Error}
 */
function decryptAesCcm(encryptedData, key = gAESCCMKeyPrimary) {
  // key = [1509720446, 1682369121, -1875608800, -373436846]) {
  // if the length is smaller than the standard mii qr code size
  if (encryptedData.length < WRAPPED_MII_DATA_LENGTH) {
    throw new Error(`decryptAesCcm: Input size is ${encryptedData.length}, expected ${WRAPPED_MII_DATA_LENGTH} or longer.`);
  }

  /** Extracted nonce */
  const nonce = encryptedData.subarray(0, 8);
  const encryptedContent = encryptedData.subarray(8);

  const cipher = new sjcl.cipher.aes(key);

  // Convert nonce and encrypted content to bits, adjusting the nonce to full size
  const encryptedBits = sjcl.codec.bytes.toBits(Array.from(encryptedContent));
  const nonceBits = sjcl.codec.bytes.toBits([...nonce, 0, 0, 0, 0]);

  // Isolate the actual ciphertext from the tag and adjust IV.
  /** Tag length in bits */
  const tlen = 128;
  const out = sjcl.bitArray.clamp(encryptedBits,
    // remove tag from out, tag length = 128
    sjcl.bitArray.bitLength(encryptedBits) - tlen);

  /** regex to find the _ctrMode function: 6 arguments and calls "bitSlice" */
  const ctrModeFuncRegex = /\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*,[^)]*\)\s*.*?bitSlice/;
  /**
   * Closure to find the _ctrMode function by matching its string representation.
   * @param {[string, Function]} entry - A [key, function] pair from Object.entries.
   * @returns {Array<string>|null} Match if function signature matches ctrMode.
   */
  // eslint-disable-next-line no-unused-vars -- key is not needed
  const ctrModeFuncMatch = ([_, fn]) => fn.toString().match(ctrModeFuncRegex);

  /**
   * The sjcl.mode.ccm._ctrMode private function.
   * @typedef {(prf: { encrypt: (input: sjcl.BitArray) => sjcl.BitArray },
   * data: sjcl.BitArray, iv: sjcl.BitArray,
   * tag: sjcl.BitArray, tlen: number, L: number
   * ) => { tag: sjcl.BitArray, data: sjcl.BitArray }} _ctrMode
   */
  const ccm = /** @type {Object<string, *>} */ (sjcl.mode.ccm);
  /**
   * jsdelivr (1.0.8 sjcl.min.js) minifies this function name to "C"
   * @type {_ctrMode}
   */
  let ctrDecrypt = /** @type {_ctrMode} */ (ccm._ctrMode) || /** @type {_ctrMode} */ (ccm.C);
  if (!ctrDecrypt) {
    // attempt to find the private _ctrMode func using our regex
    const match = Object.entries(sjcl.mode.ccm).find(ctrModeFuncMatch);
    // may throw IndexError??
    if (match) {
      ctrDecrypt = match[1];
    } else {
      throw new Error('decryptAesCcm: cannot find PRIVATE sjcl.mode.ccm._ctrMode DECRYPT FUNCTION!!!!!!');
    }
  }
  /** harcoding 3 as "L" / length; */
  const decryptedBits = ctrDecrypt(cipher, out, nonceBits, [], tlen, 3);
  // NOTE: the CBC-MAC of the qr code is NOT verified here

  /** Final output with nonce in the middle */
  const decryptedBytes = sjcl.codec.bytes.fromBits(decryptedBits.data);
  const decryptedSlice = new Uint8Array(decryptedBytes).subarray(0, 88);

  return new Uint8Array([
    ...decryptedSlice.subarray(0, 12),
    ...nonce,
    ...decryptedSlice.subarray(12)
  ]);
}

/**
 * @param {number} num - The 16-bit number.
 * @returns {Array<number>} An array representing the number as two bytes.
 */
function split16BitToArray(num) {
  return [(num >> 8) & 0xFF, num & 0xFF];
}

/**
 * Encrypts the AES-CCM portion of the QR code.
 * @param {Uint8Array} data - Input 96-byte StoreData to encrypt.
 * @returns {Uint8Array} The encrypted QR code data (CFLiWrappedMiiData).
 */
function encryptAesCcm(data) {
  // Assuming sjcl.codec.bytes is properly defined
  const nonce = data.subarray(12, 20);
  let content = new Uint8Array([...data.subarray(0, 12), ...data.subarray(20)]);

  const checksumContent = [...data.subarray(0, 12), ...nonce, ...data.subarray(20, -2)];
  const newChecksum = crc16(new Uint8Array(checksumContent));
  content = new Uint8Array([...content.subarray(0, -2), ...split16BitToArray(newChecksum)]);

  const cipher = new sjcl.cipher.aes(gAESCCMKeyPrimary);

  const paddedContent = new Uint8Array([...content, ...new Array(8).fill(0)]);
  const paddedContentBits = sjcl.codec.bytes.toBits(Array.from(paddedContent));
  const nonceBits = sjcl.codec.bytes.toBits([...nonce, 0, 0, 0, 0]);

  const encryptedBits = sjcl.mode.ccm.encrypt(cipher, paddedContentBits, nonceBits, [], 128);
  const encryptedBytes = new Uint8Array(sjcl.codec.bytes.fromBits(encryptedBits));

  const correctEncryptedContentLength = encryptedBytes.length - 8 - 16;
  const encryptedContentCorrected = encryptedBytes.subarray(0, correctEncryptedContentLength);
  const tag = encryptedBytes.subarray(encryptedBytes.length - 16);

  const result = new Uint8Array([...nonce, ...encryptedContentCorrected, ...tag]);
  return result;
}

// // ---------------------------------------------------------------------
// //  AES-CTR Encryption
// // ---------------------------------------------------------------------

/**
 * Decrypts AES-CTR-128.
 * @param {Uint8Array} encryptedData - The encrypted data.
 * @param {Uint8Array} iv - The IV for the data.
 * @param {Uint8Array} [keyData] - The key for the data.
 * @returns {Promise<Uint8Array>} The decrypted data.
 */
async function decryptAesCtr(encryptedData, iv, keyData = hexToUint8Array(AES_CTR_KEY_HEX)) {
  // Calls to SubtleCr*pto (window.cr*pto.subtle):
  const key = await sc.importKey('raw', keyData, { name: 'AES-CTR' }, false, ['decrypt']);
  const decrypted = await sc.decrypt(
    { name: 'AES-CTR', counter: iv, length: 128 }, key, encryptedData.buffer);
  return new Uint8Array(decrypted);
}

/**
 * Encrypts AES-CTR-128.
 * @param {Uint8Array} data - The input data.
 * @param {Uint8Array} [keyData] - The key for the data.
 * @returns {Promise<{encryptedData: Uint8Array, iv: Uint8Array}>} The encrypted data and new IV.
 */
async function encryptAesCtr(data, keyData = hexToUint8Array(AES_CTR_KEY_HEX)) {
  // Calls to SubtleCr*pto (window.cr*pto.subtle):
  const key = await sc.importKey('raw', keyData, { name: 'AES-CTR' }, false, ['encrypt']);
  // window.cr*pto.getRandomValues:
  const iv = crpyto.getRandomValues(new Uint8Array(16));

  const encrypted = await sc.encrypt({ name: 'AES-CTR', counter: iv, length: 128 }, key, data.buffer);
  return { encryptedData: new Uint8Array(encrypted), iv };
}

// // ---------------------------------------------------------------------
// //  QR Code Creation and Scanning
// // ---------------------------------------------------------------------

// These functions are meant to be used completely inline within
// the sample and weren't written to be reused at all...

const qrCodeContainer = /** @type {HTMLDivElement} */ (document.getElementById('qr-code-container'));

/**
 * Generates a QR code of the data using {@link encryptAesCcm} and {@link encryptAesCtr}.
 * @param {Uint8Array} [storeData] - Input StoreData.
 * @param {Uint8Array} [extraData] - Input extra data.
 * @returns {Promise<void>} The code is emitted to HTML ID "qr-code-container".
 * @throws {Error} Throws if "qr-code-container" element does not exist.
 */
async function generateQrCode(storeData = hexEditorBaseInput.saveToArray(),
  extraData = hexEditorExtraInput.saveToArray()) {
  // effectively changes birth platform to 3ds
  // if this is not set then the code
  // will not scan on 3ds (wiiu sets this)
  storeData[0x03] = 0x30; // '0'

  const encryptedBase = encryptAesCcm(storeData);

  let qrData = encryptedBase;

  if (extraData.length > 0) {
    // Append CRC32 for extra data
    const dataForCRC32 = new Uint8Array([...encryptedBase, ...extraData]);
    console.log('data into crc32:', uint8ArrayToHex(dataForCRC32).replace(/(.{2})/g, '$1 '));
    const crc32Val = crc32(dataForCRC32);
    const crc32Bytes = new Uint8Array(
      [crc32Val & 0xff, (crc32Val >> 8) & 0xff, (crc32Val >> 16) & 0xff, (crc32Val >> 24) & 0xff]
    );
    console.log('crc32: ', uint8ArrayToHex(crc32Bytes).replace(/(.{2})/g, '$1 '));
    const extraDataWithCRC32 = new Uint8Array([...extraData, ...crc32Bytes]);
    const { encryptedData, iv } = await encryptAesCtr(extraDataWithCRC32);
    qrData = new Uint8Array([...qrData, ...iv, ...encryptedData]);
    console.log(qrData);
  }

  if (!qrCodeContainer || !(qrCodeContainer.firstElementChild instanceof HTMLImageElement)) {
    throw new Error('generateQrCode: Element qr-code-container or its child is not an image.');
  }
  /** @type {HTMLImageElement} */ (qrCodeContainer.firstElementChild).src =
    QRCode.generatePNG(qrData, { margin: null });
}

const extraDataWarning = /** @type {HTMLElement} */ (document.getElementById('extra-data-warning'));
const extraDataWarningInner = /** @type {HTMLElement} */ (document.getElementById('extra-data-warning-inner'));

/** @typedef {{bytes: Uint8Array}} QrScannerResult */
/**
 * The callback for the scanned QR code data from QrScanner.
 * @param {QrScannerResult} result - The result object received from QrScanner.
 * @throws {Error} Throws if scanned length is 0.
 */
function handleQrCode(result) {
  if (!result || !result.bytes) {
    return;
  }

  cameraScanner.stop();

  if (!result.bytes.length) {
    throw new Error(`handleQrCode: Scanned QR Code has byte length of ${result.bytes.length}.`);
  }
  const qrData = new Uint8Array(result.bytes);
  /** Decrypt the first AES-CCM encrypted portion. */
  const decryptedData = decryptAesCcm(qrData.subarray(0, WRAPPED_MII_DATA_LENGTH));

  hexEditorBaseOutput.loadFromArray(decryptedData);
  extraDataWarning.style.display = 'none';

  if (qrData.length > WRAPPED_MII_DATA_LENGTH) {
    const iv = qrData.subarray(WRAPPED_MII_DATA_LENGTH, 128);
	/** Slice of the encrypted data - an ArrayBuffer is needed so a slice is made. */
    const encryptedExtra = qrData.slice(128, -4);
    decryptAesCtr(encryptedExtra, iv).then((decryptedExtraData) => {
      hexEditorExtraOutput.container.style.display = 'initial';
      hexEditorExtraOutput.loadFromArray(decryptedExtraData);
    })
      .catch((error) => {
        hexEditorExtraOutput.container.style.display = 'initial';
        extraDataWarning.style.display = 'initial';
        extraDataWarningInner.textContent = error;
        hexEditorExtraOutput.loadFromArray(qrData.subarray(WRAPPED_MII_DATA_LENGTH));
      });
  } else {
    hexEditorExtraOutput.container.style.display = 'none';
  }
}

// // ---------------------------------------------------------------------
// //  Utilities used when downloading data
// // ---------------------------------------------------------------------

/**
 * @param {Uint8Array} data - The data from which to extract the string.
 * @param {number} startOffset - The offset at which to get the text.
 * @param {number} [byteLength] - The length of the string in bytes.
 * @returns {string} The extracted string.
 */
function extractUTF16LEText(data, startOffset, byteLength = 20) {
  let endPosition = startOffset;

  // Determine the byte order based on the isBigEndian flag
  const decoder = new TextDecoder('utf-16le');

  // Find the position of the null terminator (0x00 0x00)
  while (endPosition < startOffset + byteLength) {
    if (data[endPosition] === 0x00 && data[endPosition + 1] === 0x00) {
      break;
    }
    endPosition += 2; // Move in 2-byte increments (UTF-16)
  }

  // Extract and decode the name bytes
  const nameBytes = data.subarray(startOffset, endPosition);
  return decoder.decode(nameBytes);
}

/**
 * @param {Uint8Array} data - The Ver3StoreData data.
 * @returns {string} The name from the data.
 */
function getNameFromCFSD(data) {
  return extractUTF16LEText(data, 0x1A);
}

/**
 * @param {number} length - The length of the extra data.
 * @returns {string} A generic name that can be used in a filename to describe the extra data.
 */
function getExtraDataGenericName(length) {
  switch (length) {
    case 40:
      return 'miitomo-data';
    case 240:
      return 'tomodachi-life-data';
    case 192:
      return 'miitopia-data';
    default:
      return 'data';
  }
}

/** @returns {string} The current time in a format that can be included in a file name. */
function getFormattedTime() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
}

// // ---------------------------------------------------------------------
// //  Helpers for Downloading Data
// // ---------------------------------------------------------------------

/**
 * General function to download any data as a file.
 * It will create a blob of the data, then make an anchor
 * element with the blob link and click on it.
 * @param {Uint8Array} data - The data to download.
 * @param {string} filename - The filename that the file should appear with.
 * @param {string} [mimeType] - The MIME type for the file to download.
 */
function downloadData(data, filename, mimeType = 'application/octet-stream') {
  if (data.length < 1) {
    return; // ignore blank data
  }
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url); // Clean up the object URL
}

/**
 * Function to download StoreData using {@link downloadData}.
 * @param {Uint8Array} [data] - The StoreData to download.
 */
function downloadStoreData(data = hexEditorBaseOutput.saveToArray()) {
  /** extracted name */
  const name = getNameFromCFSD(data);
  // base name will be name if it is defined
  let fileBaseName = name;
  if (!fileBaseName) {
    // otherwise compose a base name from the date and type
    fileBaseName = getFormattedTime() + '-from-mii-qr-code';
  }
  downloadData(data, fileBaseName + '.cfsd');
}

/**
 * Function to download extra data using {@link downloadData}.
 * @param {Uint8Array} [extraData] - The extra data to download.
 * @param {Uint8Array} [storeData] - The StoreData associated, to resolve a name.
 */
function downloadExtraData(extraData = hexEditorExtraOutput.saveToArray(),
  storeData = hexEditorBaseOutput.saveToArray()) {
  /** Extracted name from StoreData, or timestamp. */
  let prefix = '';
  if (!storeData || !(prefix = getNameFromCFSD(storeData))) {
    prefix = getFormattedTime();
  } // use in place of name

  let fileBaseName = getExtraDataGenericName(extraData.length);
  if (!fileBaseName) {
    fileBaseName = 'extra-mii-qr-data';
  }
  fileBaseName = prefix + '-' + fileBaseName;
  downloadData(extraData, fileBaseName + '.bin');
}

// // ---------------------------------------------------------------------
// //  Helpers for Uploading Data
// // ---------------------------------------------------------------------

/** Minimum size for Mii data (CFLiPackedMiiDataCore) */
const PACKED_MII_DATA_SIZE = 72;
/** Maximum accepted size for StoreData (CFLiMiiDataPacket, FFLStoreData) */
const STORE_DATA_SIZE = 96;

/**
 * Function to load StoreData from file.
 * @param {Event} event - The upload event.
 */
function loadStoreDataFromFile(event) {
  const files = /** @type {HTMLInputElement} */ (event.target).files;
  if (!files || !files[0]) {
    return;
  }

  const fileSize = files[0].size;
  if (fileSize < PACKED_MII_DATA_SIZE || fileSize > STORE_DATA_SIZE) {
    alert(`StoreData (.cfsd) file must be between ${PACKED_MII_DATA_SIZE} and ${STORE_DATA_SIZE} bytes.`);
    return;
  }

  const reader = new FileReader();
  reader.onload = function () {
    if (!(reader.result instanceof ArrayBuffer)) {
      console.warn('loadExtraDataFromFile: reader.result is not an ArrayBuffer.');
      return;
    }
    let baseData = new Uint8Array(reader.result);

    // Pad StoreData to 96 bytes if the size is smaller.
    if (baseData.length < STORE_DATA_SIZE) {
      const paddedBaseData = new Uint8Array(STORE_DATA_SIZE);
      paddedBaseData.set(baseData); // Copy original data
      baseData = paddedBaseData; // Replace with padded data
    }

    // Load into the hex editor for base data (StoreData)
    hexEditorBaseInput.loadFromArray(baseData);
  };

  reader.readAsArrayBuffer(files[0]);
}

/**
 * Function to load extra data from file.
 * @param {Event} event - The upload event.
 */
function loadExtraDataFromFile(event) {
  const files = /** @type {HTMLInputElement} */ (event.target).files;
  if (!files || !files[0]) {
    return;
  }

  const reader = new FileReader();
  reader.onload = function () {
    if (!(reader.result instanceof ArrayBuffer)) {
      console.warn('loadExtraDataFromFile: reader.result is not an ArrayBuffer.');
      return;
    }
    const extraData = new Uint8Array(reader.result);

    // Load into the hex editor for extra data
    hexEditorExtraInput.loadFromArray(extraData);
    hexEditorExtraOutput.container.style.display = 'initial';
  };

  reader.readAsArrayBuffer(files[0]);
}

// // ---------------------------------------------------------------------
// //  Page Setup
// // ---------------------------------------------------------------------

/**
 * Event listener for hex input field to handle both hex and base64.
 * @param {HexEditor} hexEditorInstance - The hex editor instance.
 */
function setupHexEditorPasteHandling(hexEditorInstance) {
  const hexTextArea = hexEditorInstance.textArea;

  hexTextArea.addEventListener('paste',
  /** @param {ClipboardEvent} event - The paste event. */ (event) => {
      event.preventDefault();

      if (!event.clipboardData) {
        return;
      }
      const pasteData = event.clipboardData.getData('text').trim().replace(/\s+/g, '');

      // If the pasted data is not valid hex, try to decode as base64
      if (!isHex(pasteData)) {
        if (isBase64(pasteData)) {
        // Decode base64 and load as hex into the HexEditor
          const decodedBase64 = base64ToUint8Array(pasteData);
          hexEditorInstance.loadFromArray(decodedBase64);
        } else {
          alert('Invalid hex or base64 data.');
        }
      } else {
      // Process valid hex normally
        hexEditorInstance.textArea.value = pasteData.replace(/(.{2})/g, '$1 ').trim();
      }

      hexEditorInstance.textArea.dispatchEvent(new Event('input'));
    });
}

/** @type {ReturnType<QrScanner>} */
let cameraScanner;

const camList = /** @type {HTMLSelectElement} */ (document.getElementById('cam-list'));

const startCameraButton = /** @type {HTMLButtonElement} */ (document.getElementById('start-camera'));
const stopCameraButton = /** @type {HTMLButtonElement} */ (document.getElementById('stop-camera'));

// Initialize hex editors for the inputs and outputs
/** @type {HexEditor} */ let hexEditorBaseInput;
/** @type {HexEditor} */ let hexEditorExtraInput;
/** @type {HexEditor} */ let hexEditorBaseOutput;
/** @type {HexEditor} */ let hexEditorExtraOutput;

document.addEventListener('DOMContentLoaded', () => {
  /**
   * List of EITHER element IDs OR variable names that
   * should be guaranteed non-null in JSDoc, and will
   * be filtered down to elements that do not exist.
   */
  /*
  const missing = [
    // Constants set from elements.
    'qrCodeContainer', 'extraDataWarning', 'extraDataWarningInner',
    'cameraScanner', 'camList',
    // Element IDs that are not constants.
    'qr-video', 'file-input', 'key-type',
    'generate-qr-code', 'download-store-data', 'download-extra-data'
  ]
    // @ts-ignore - it is indexable by string and we just set above
    .filter(id => !(globalThis[id] instanceof HTMLElement));
  if (missing.length) {
    alert(`HTML elements not found: ${missing.join(', ')}`);
  }
  */
  hexEditorBaseInput = new HexEditor(document.getElementById('hex-editor-storedata'), false);

  setupHexEditorPasteHandling(hexEditorBaseInput); // Attach paste handling to this instance

  hexEditorExtraInput = new HexEditor(document.getElementById('hex-editor-extra'), false);
  hexEditorBaseOutput = new HexEditor(document.getElementById('hex-editor-decrypt-storedata'), true);
  hexEditorExtraOutput = new HexEditor(document.getElementById('hex-editor-decrypt-extra'), true);

  // QR Code Scanner for decoding
  cameraScanner = new QrScanner(document.getElementById('qr-video'),
    handleQrCode, {
      highlightScanRegion: true,
      highlightCodeOutline: true
    });

  // // ---------------------------------------------------------------------
  // //  Event Listeners
  // // ---------------------------------------------------------------------

  /** @type {HTMLButtonElement} */ (document.getElementById('generate-qr-code'))
    .addEventListener('click', () => {
      generateQrCode();
    });
  /** @type {HTMLButtonElement} */ (document.getElementById('download-store-data'))
    .addEventListener('click', () => {
      downloadStoreData();
    });
  /** @type {HTMLButtonElement} */ (document.getElementById('download-extra-data'))
    .addEventListener('click', () => {
      downloadExtraData();
    });

  startCameraButton.addEventListener('click', () => {
    cameraScanner.start().then(() => {
      // List cameras after the scanner started to avoid listCamera's stream and the scanner's stream being requested
      // at the same time which can result in listCamera's unconstrained stream also being offered to the scanner.
      // Note that we can also start the scanner after listCameras, we just have it this way around in the demo to
      // start the scanner earlier.
      const existingCameras = document.getElementsByClassName('device-camera');
      [...existingCameras].forEach((camera) => {
        // go ahead and remove all existing cameras to repopulate camera list
        camera.remove();
      });
      /** @type {Promise<Array<{id: string, label: string}>>} */ (QrScanner.listCameras(true)).then(
        cameras => cameras.forEach((camera) => {
          const option = document.createElement('option');
          option.value = camera.id;
          option.text = camera.label;
          option.className = 'device-camera';
          camList.add(option);
        }));
    });
  });

  camList.addEventListener('change', (event) => {
    cameraScanner.setCamera(/** @type {HTMLInputElement} */(event.target).value);
  });

  stopCameraButton.addEventListener('click', () => {
    if (cameraScanner) {
      cameraScanner.stop();
    }
  });

  /** @type {HTMLInputElement} */ (document.getElementById('file-input')).addEventListener('change', (event) => {
    const files = /** @type {HTMLInputElement} */ (event.target).files;
    if (files && files[0]) {
      QrScanner.scanImage(files[0], { returnDetailedScanResult: true })
        .then(handleQrCode);
    }
  });

  /** @type {HTMLInputElement} */ (document.getElementById('key-type')).addEventListener('change', (event) => {
    const type = /** @type {HTMLInputElement} */ (event.target).value;
    const newKey = AES_CCM_KEYSLOT_0x31_KEYS[Number(type)];
    gAESCCMKeyPrimary = newKey;
    console.log('key changed to: ' + gAESCCMKeyPrimary);
  });

  // Initialize QR Scanner
  QrScanner.hasCamera().then(/** @param {boolean} hasCamera - Presence of camera. */(hasCamera) => {
    if (!hasCamera) {
      startCameraButton.disabled = true;
    }
    if (!hasCamera) {
      stopCameraButton.disabled = true;
    }
  });
});
