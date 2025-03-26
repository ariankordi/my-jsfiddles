// @ts-check

/* eslint @stylistic/indent: ['error', 2] -- Define indent rules. */
/* @stylistic/no-multi-spaces: 'off' -- Allow spaced comments. */


// // ---------------------------------------------------------------------
// //  AES Keys
// // ---------------------------------------------------------------------

// https://www.3dbrew.org/wiki/PSPXI:EncryptDecryptAes#Key_Types
/** Type 2, slot 0x31 */
const AES_CCM_KEYSLOT_0x31_HEX = '59FC817E6446EA6190347B20E9BDCE52';
/** Dev variant of {@link AES_CCM_KEYSLOT_0x31_HEX}. */
const AES_CCM_KEYSLOT_0x31_DEV_HEX = '12DF92B6FFD438AB291C4FD4D7CE256D';

const AES_CTR_KEY_HEX = '30819F300D06092A864886F70D010101';

/** SJCL converted version of {@link AES_CCM_KEYSLOT_0x31_HEX}. */
const AES_CCM_KEYSLOT_0x31_BITS = sjcl.codec.hex.toBits(AES_CCM_KEYSLOT_0x31_HEX);
/** SJCL converted version of {@link AES_CCM_KEYSLOT_0x31_DEV_HEX}. */
const AES_CCM_KEYSLOT_0x31_DEV_BITS = sjcl.codec.hex.toBits(AES_CCM_KEYSLOT_0x31_DEV_HEX);

/** Reassigned to dev/prod. */
let gAESCCMKeyPrimary = AES_CCM_KEYSLOT_0x31_BITS;
/** @param {boolean} isDev - Controls whether to use the dev key or not. */
const toggleAESCCMKeyMode = (isDev) => {
  gAESCCMKeyPrimary = isDev ? AES_CCM_KEYSLOT_0x31_DEV_BITS : AES_CCM_KEYSLOT_0x31_BITS;
};

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

/**
 * @param {Uint8Array|Array<number>} data - The data to create a checksum of.
 * @returns {number} The CRC-16 checksum.
 */
function crc16(data) {
  let crc = 0xFFFF;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return crc & 0xFFFF;
}

// Define the polynomial used in CRC-32/CKSUM
const CRC32_CKSUM_POLYNOMIAL = 0x04C11DB7;

// Create a table for CRC-32/CKSUM lookup
const crc32CksumTable = new Uint32Array(256);

/**
 * Function to generate a CRC-32/CKSUM table.
 * @param {Uint32Array} table - The Uint32Array to populate with the table.
 * @param {number} [polynomial] - The polynomial to generate the CRC-32 table with.
 */
function generateCrc32CksumTable(table, polynomial = CRC32_CKSUM_POLYNOMIAL) {
  for (let i = 0; i < 256; i++) {
    let crc = i << 24;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x80000000) {
        crc = (crc << 1) ^ polynomial;
      } else {
        crc = crc << 1;
      }
    }
    table[i] = crc >>> 0; // Ensure the value is an unsigned 32-bit integer
  }
}

// Call the table generation function.
generateCrc32CksumTable(crc32CksumTable);

/**
 * @param {Uint8Array|Array<number>} input - The data to create a checksum of.
 * @param {Uint32Array} [table] - The CRC-32 table to use.
 * @returns {number} The CRC-32 checksum.
 */
function crc32(input, table = crc32CksumTable) {
  /** Initial value for CRC-32/CKSUM */
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
 * @param {Uint8Array} encryptedData - Input QR code data (CFLiWrappedMiiData)
 * @param {Array<number>} [key] - The key to pass into sjcl.
 * @returns {Uint8Array} The encrypted StoreData.
 * @throws {Error}
 */
function decryptAesCcm(encryptedData, key = gAESCCMKeyPrimary) {
  // key = [1509720446, 1682369121, -1875608800, -373436846]) {
  // if the length is smaller than the standard mii qr code size
  if (encryptedData.length < 112) {
    throw new Error('Mii QR codes should be 112 or more bytes long, yours is ' + encryptedData.length);
  }

  /** Extracted nonce */
  const nonce = encryptedData.slice(0, 8);
  const encryptedContent = encryptedData.slice(8);

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
  /** Closure to match string representation of the function. */
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
  const decryptedSlice = new Uint8Array(decryptedBytes).slice(0, 0x58);

  return new Uint8Array([
    ...decryptedSlice.slice(0, 12),
    ...nonce,
    ...decryptedSlice.slice(12)
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
  const nonce = data.slice(12, 20);
  let content = [...data.slice(0, 12), ...data.slice(20)];

  const checksumContent = [...data.slice(0, 12), ...nonce, ...data.slice(20, -2)];
  const newChecksum = crc16(new Uint8Array(checksumContent));
  content = [...content.slice(0, -2), ...split16BitToArray(newChecksum)];

  const cipher = new sjcl.cipher.aes(gAESCCMKeyPrimary);

  const paddedContent = new Uint8Array([...content, ...new Array(8).fill(0)]);
  const paddedContentBits = sjcl.codec.bytes.toBits(Array.from(paddedContent));
  const nonceBits = sjcl.codec.bytes.toBits([...nonce, 0, 0, 0, 0]);

  const encryptedBits = sjcl.mode.ccm.encrypt(cipher, paddedContentBits, nonceBits, [], 128);
  const encryptedBytes = sjcl.codec.bytes.fromBits(encryptedBits);

  const correctEncryptedContentLength = encryptedBytes.length - 8 - 16;
  const encryptedContentCorrected = encryptedBytes.slice(0, correctEncryptedContentLength);
  const tag = encryptedBytes.slice(encryptedBytes.length - 16);

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

/**
 * Generates a QR code of the data using {@link encryptAesCcm} and {@link encryptAesCtr}.
 * @param {Uint8Array} [storeData] - Input StoreData.
 * @param {Uint8Array} [extraData] - Input extra data.
 * @returns {Promise<void>} The code is emitted to HTML ID "qr-code-container".
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

  const qrContainer = document.getElementById('qr-code-container');
  qrContainer.firstElementChild.src = QRCode.generatePNG(qrData, { margin: null });
}

/**
 * The callback for the scanned QR code data from QrScanner.
 * @param {{bytes: Uint8Array}} result - The result object received from QrScanner.
 */
function handleQrCode(result) {
  if (!result || !result.bytes) {
    return;
  }

  cameraScanner.stop();

  const qrData = new Uint8Array(result.bytes);
  /** First 112 bytes are AES-CCM */
  const decryptedData = decryptAesCcm(qrData.slice(0, 112));

  hexEditorBaseOutput.loadFromArray(decryptedData);
  document.getElementById('extra-data-warning').style.display = 'none';

  if (qrData.length > 112) {
    const iv = qrData.slice(112, 128);
    const encryptedExtra = qrData.slice(128, -4);
    decryptAesCtr(encryptedExtra, iv).then((decryptedExtraData) => {
      document.getElementById('hex-editor-decrypt-extra').style.display = 'initial';
      hexEditorExtraOutput.loadFromArray(decryptedExtraData);
    })
      .catch((error) => {
        document.getElementById('hex-editor-decrypt-extra').style.display = 'initial';
        document.getElementById('extra-data-warning').style.display = 'initial';
        document.getElementById('extra-data-warning-inner').textContent = error;
        hexEditorExtraOutput.loadFromArray(qrData.slice(112));
      });
  } else {
    document.getElementById('hex-editor-decrypt-extra').style.display = 'none';
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
  const nameBytes = data.slice(startOffset, endPosition);
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
// //  Helpers for downloading data
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

// Initialize hex editors for the inputs and outputs
/** @type {HexEditor} */ let hexEditorBaseInput;
/** @type {HexEditor} */ let hexEditorExtraInput;
/** @type {HexEditor} */ let hexEditorBaseOutput;
/** @type {HexEditor} */ let hexEditorExtraOutput;

document.addEventListener('DOMContentLoaded', () => {
  hexEditorBaseInput = new HexEditor(document.getElementById('hex-editor-storedata'), false);

  setupHexEditorPasteHandling(hexEditorBaseInput); // Attach paste handling to this instance

  hexEditorExtraInput = new HexEditor(document.getElementById('hex-editor-extra'), false);
  hexEditorBaseOutput = new HexEditor(document.getElementById('hex-editor-decrypt-storedata'), true);
  hexEditorExtraOutput = new HexEditor(document.getElementById('hex-editor-decrypt-extra'), true);
});

// QR Code Scanner for decoding
const cameraScanner = new QrScanner(document.getElementById('qr-video'),
  result => handleQrCode(result), {
    highlightScanRegion: true,
    highlightCodeOutline: true
  });
const camList = document.getElementById('cam-list');

// // ---------------------------------------------------------------------
// //  Event Listeners
// // ---------------------------------------------------------------------

/*
  document.getElementById('start-camera').addEventListener('click', () => {
    cameraScanner = new QrScanner(document.getElementById('qr-video'), result => handleQrCode(result));
    cameraScanner.start();
  });
*/
document.getElementById('start-camera').addEventListener('click', () => {
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
    QrScanner.listCameras(true).then(cameras => cameras.forEach((camera) => {
      const option = document.createElement('option');
      option.value = camera.id;
      option.text = camera.label;
      option.className = 'device-camera';
      camList.add(option);
    }));
  });
});

camList.addEventListener('change', (event) => {
  cameraScanner.setCamera(event.target.value);
});

document.getElementById('stop-camera').addEventListener('click', () => {
  if (cameraScanner) {
    cameraScanner.stop();
  }
});

document.getElementById('file-input').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    QrScanner.scanImage(file, { returnDetailedScanResult: true })
      .then(result => handleQrCode(result));
  }
});

// Tab functionality
/*
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`).classList.add('active');
}
*/

document.getElementById('use-dev-key').addEventListener('change', (event) => {
  toggleAESCCMKeyMode(event.target.checked);
  console.log('current key: ' + gAESCCMKeyPrimary);
});

// Initialize QR Scanner
QrScanner.hasCamera().then(/** @param {boolean} hasCamera - Presence of camera. */ (hasCamera) => {
  if (!hasCamera) {
    document.getElementById('start-camera').disabled = true;
  }
  if (!hasCamera) {
    document.getElementById('stop-camera').disabled = true;
  }
});

// Constants for StoreData size
/** Minimum size for StoreData (technically not StoreData then but) */
const STORE_DATA_MIN_SIZE = 72;
/** Maximum accepted size for StoreData (CFLiPackedMiiDataPacket, FFLStoreData) */
const STORE_DATA_MAX_SIZE = 96;

/**
 * Function to load StoreData from file.
 * @param {ProgressEvent<FileReader>} event - The upload event.
 */
function loadStoreDataFromFile(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const fileSize = file.size;
  if (fileSize < STORE_DATA_MIN_SIZE || fileSize > STORE_DATA_MAX_SIZE) {
    alert(`StoreData (.cfsd) file must be between ${STORE_DATA_MIN_SIZE} and ${STORE_DATA_MAX_SIZE} bytes.`);
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    let baseData = new Uint8Array(e.target.result);

    // Pad StoreData to 96 bytes if it's less
    if (baseData.length < 96) {
      const paddedBaseData = new Uint8Array(96);
      paddedBaseData.set(baseData); // Copy original data
      baseData = paddedBaseData; // Replace with padded data
    }

    // Load into the hex editor for base data (StoreData)
    hexEditorBaseInput.loadFromArray(baseData);
  };

  reader.readAsArrayBuffer(file);
}

/**
 * Function to load extra data from file.
 * @param {ProgressEvent<FileReader>} event - The upload event.
 */
function loadExtraDataFromFile(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const extraData = new Uint8Array(e.target.result);

    // Load into the hex editor for extra data
    hexEditorExtraInput.loadFromArray(extraData);
    document.getElementById('hex-editor-decrypt-extra').style.display = 'initial';
  };

  reader.readAsArrayBuffer(file);
}