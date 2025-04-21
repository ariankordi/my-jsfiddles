// AES keys.
const AES_CCM_KEYSLOT_0x31_HEX     = '59FC817E6446EA6190347B20E9BDCE52'; // Type 2, slot 0x31
                                                                          // https://www.3dbrew.org/wiki/PSPXI:EncryptDecryptAes#Key_Types
const AES_CCM_KEYSLOT_0x31_DEV_HEX = '12DF92B6FFD438AB291C4FD4D7CE256D'; // Dev variant of above key.

const AES_CTR_KEY_HEX              = '30819F300D06092A864886F70D010101';

// Converted AES-CCM keys for sjcl
const AES_CCM_KEYSLOT_0x31_BITS     = sjcl.codec.hex.toBits(AES_CCM_KEYSLOT_0x31_HEX);
const AES_CCM_KEYSLOT_0x31_DEV_BITS = sjcl.codec.hex.toBits(AES_CCM_KEYSLOT_0x31_DEV_HEX);

let gAESCCMKeyPrimary = AES_CCM_KEYSLOT_0x31_BITS; // Reassigned to dev/prod.
const toggleAESCCMKeyMode = isDev => // true controls whether is dev or not
	{ gAESCCMKeyPrimary = isDev ? AES_CCM_KEYSLOT_0x31_DEV_BITS : AES_CCM_KEYSLOT_0x31_BITS };

const crpyto = window['crypt'+'o']; // jsfiddle blocks this word???
const sc = crpyto.subtle;           // Shortcut to SubtleCr*pto.
// ^^ Needed or else the fiddle will not save

// Utility: Hex <-> Uint8Array conversion
function hexToUint8Array(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function uint8ArrayToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Utility: Base64 <-> Uint8Array conversion
function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Helper function to check if a string is valid hex
function isHex(str) {
  const hexRegex = /^[0-9A-Fa-f]+$/;
  return hexRegex.test(str);
}

// Helper function to check if a string is valid base64
function isBase64(str) {
  try {
    atob(str);  // `atob` will throw an error if the string is not valid base64
    return true;
  } catch (e) {
    return false;
  }
}

// Event listener for hex input field to handle both hex and base64
function setupHexEditorPasteHandling(hexEditorInstance) {
  const hexTextArea = hexEditorInstance.textArea;

  hexTextArea.addEventListener('paste', (event) => {
    event.preventDefault();

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
      hexEditorInstance.textArea.value = pasteData.replace(/(.{2})/g, "$1 ").trim();
    }

    hexEditorInstance.textArea.dispatchEvent(new Event('input'));
  });
}

// CRC16 and CRC32 utilities
function crc16(data, current = 0x0000, poly = 0x1021) {
  let crc = current & 0xFFFF;

  for (let i = 0; i < data.length; i++) {
    crc ^= (data[i] << 8);
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000)
        ? ((crc << 1) ^ poly) & 0xFFFF
        : (crc << 1) & 0xFFFF;
    }
  }

  return crc & 0xFFFF;
}

// Define the polynomial used in CRC-32/CKSUM
const CRC32_CKSUM_POLYNOMIAL = 0x04C11DB7;

// Create a table for CRC-32/CKSUM lookup
let crc32CksumTable = new Uint32Array(256);

// Generate the CRC-32/CKSUM table
function generateCrc32CksumTable() {
  for (let i = 0; i < 256; i++) {
    let crc = i << 24;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x80000000) {
        crc = (crc << 1) ^ CRC32_CKSUM_POLYNOMIAL;
      } else {
        crc = crc << 1;
      }
    }
    crc32CksumTable[i] = crc >>> 0; // Ensure the value is an unsigned 32-bit integer
  }
}

// Call the table generation function
generateCrc32CksumTable();

// CRC-32/CKSUM function
function crc32(input) {
  let crc = 0x00000000; // Initial value for CRC-32/CKSUM
  for (let i = 0; i < input.length; i++) {
    const byte = (input[i] ^ (crc >>> 24)) & 0xFF;
    crc = (crc32CksumTable[byte] ^ (crc << 8)) >>> 0;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0; // XOR with 0xFFFFFFFF at the end and ensure it's unsigned
}

// AES-CCM Decryption (using private ctrMode function)
function decryptAesCcm(encryptedData) {
  if (encryptedData.length < 112) {
    throw new Error('Mii QR codes should be 112 or more bytes long, yours is ' + encryptedData.length);
  }

  const nonce = encryptedData.slice(0, 8);
  const encryptedContent = encryptedData.slice(8);

  const cipher = new sjcl.cipher.aes(gAESCCMKeyPrimary);

  const encryptedBits = sjcl.codec.bytes.toBits(Array.from(encryptedContent));
  const nonceBits = sjcl.codec.bytes.toBits([...nonce, 0, 0, 0, 0]);

  const tlen = 128; // Tag length in bits
  const out = sjcl.bitArray.clamp(encryptedBits, sjcl.bitArray.bitLength(encryptedBits) - tlen);

  const ctrDecrypt = sjcl.mode.ccm._ctrMode || sjcl.mode.ccm.C;
  const decryptedBits = ctrDecrypt(cipher, out, nonceBits, [], tlen, 3);

  const decryptedBytes = sjcl.codec.bytes.fromBits(decryptedBits.data);
  const decryptedSlice = new Uint8Array(decryptedBytes).slice(0, 0x58);

  return new Uint8Array([
    ...decryptedSlice.slice(0, 12),
    ...nonce,
    ...decryptedSlice.slice(12)
  ]);
}

// AES-CTR Decryption (for extra data)
async function decryptAesCtr(encryptedData, iv) {
  // Calls to SubtleCr*pto (window.cr*pto.subtle):
  const key = await sc.importKey('raw', hexToUint8Array(AES_CTR_KEY_HEX), { name: 'AES-CTR' }, false, ['decrypt']);
  const decrypted = await sc.decrypt({ name: 'AES-CTR', counter: iv, length: 128 }, key, encryptedData.buffer);
  return new Uint8Array(decrypted);
}

// General function to download any data as a file
function downloadData(dataArray, filename) {
	if (dataArray.length < 1) return; // ignore blank data
  const blob = new Blob([dataArray], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url); // Clean up the object URL
}

// Initialize hex editors for the inputs and outputs
let hexEditorBaseInput, hexEditorExtraInput, hexEditorBaseOutput, hexEditorExtraOutput;


function extractUTF16LEText(data, startOffset) {
  const length = 20;
  let endPosition = startOffset;

  // Determine the byte order based on the isBigEndian flag
  const decoder = new TextDecoder('utf-16le');

  // Find the position of the null terminator (0x00 0x00)
  while (endPosition < startOffset + length) {
    if (data[endPosition] === 0x00 && data[endPosition + 1] === 0x00) {
      break;
    }
    endPosition += 2; // Move in 2-byte increments (UTF-16)
  }

  // Extract and decode the name bytes
  const nameBytes = data.slice(startOffset, endPosition);
  return decoder.decode(nameBytes);
}
function getNameFromCFSD(data) {
  return extractUTF16LEText(data, 0x1A);
}
function getFormattedTime() {
  const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
}

// Function to download StoreData
function downloadStoreData() {
  const data = hexEditorBaseOutput.saveToArray(); // Get the Uint8Array from the hex editor
  const name = getNameFromCFSD(data); // extract name
  // base name will be name if it is defined
  let fileBaseName = name;
  if (!fileBaseName)
    // otherwise compose a base name from the date and type
    fileBaseName = getFormattedTime() + '-from-mii-qr-code.cfsd';
  downloadData(data, fileBaseName + '.cfsd');
}

function getExtraDataGenericName(data) {
	switch (data.length) {
  	case 40:
    	return 'miitomo-data';
    case 240:
    	return 'tomodachi-life-data';
    case 192:
    	return 'miitopia-data';
    default:
    	break;
  }
}

// Function to download extra data
function downloadExtraData() {
  const extraData = hexEditorExtraOutput.saveToArray(); // Get the Uint8Array from the hex editor
  const storeData = hexEditorBaseOutput.saveToArray();
  let name = getNameFromCFSD(storeData); // extract name
	if(!name)
  	name = getFormattedTime(); // use in place of name

  let fileBaseName = getExtraDataGenericName(extraData);
  if(!fileBaseName)
  	fileBaseName = 'extra-mii-qr-data';
  fileBaseName = name + '-' + fileBaseName;
  downloadData(extraData, fileBaseName + '.bin'); // Use the abstracted function
}

document.addEventListener('DOMContentLoaded', () => {
  hexEditorBaseInput = new HexEditor(document.getElementById('hex-editor-storedata'), false);
  
  setupHexEditorPasteHandling(hexEditorBaseInput);  // Attach paste handling to this instance
  
  hexEditorExtraInput = new HexEditor(document.getElementById('hex-editor-extra'), false);
   hexEditorBaseOutput = new HexEditor(document.getElementById('hex-editor-decrypt-storedata'), true);
  hexEditorExtraOutput = new HexEditor(document.getElementById('hex-editor-decrypt-extra'), true);
});

// QR Code Generation
async function generateQrCode() {
  const baseData = hexEditorBaseInput.saveToArray();
  const encryptedBase = encryptAesCcm(baseData);

  const extraData = hexEditorExtraInput.saveToArray();
  let qrData = encryptedBase;

  if (extraData.length > 0) {
    // Append CRC32 for extra data
    const dataForCRC32 = new Uint8Array([...encryptedBase, ...extraData]);
    console.log('data into crc32:', uint8ArrayToHex(dataForCRC32).replace(/(.{2})/g, '$1 '))
    const crc32Val = crc32(dataForCRC32);
    const crc32Bytes = new Uint8Array([crc32Val & 0xff, (crc32Val >> 8) & 0xff, (crc32Val >> 16) & 0xff, (crc32Val >> 24) & 0xff]);
   console.log('crc32: ', uint8ArrayToHex(crc32Bytes).replace(/(.{2})/g, '$1 '))
    const extraDataWithCRC32 = new Uint8Array([...extraData, ...crc32Bytes]);
    const { encryptedData, iv } = await encryptAesCtr(extraDataWithCRC32);
    qrData = new Uint8Array([...qrData, ...iv, ...encryptedData]);
    console.log(qrData)
  }

  const qrContainer = document.getElementById('qr-code-container');
  qrContainer.firstElementChild.src = QRCode.generatePNG(qrData, {margin: null});

}

// QR Code Scanner for decoding
const cameraScanner = new QrScanner(document.getElementById('qr-video'), result => handleQrCode(result), {
  onDecodeError: error => {
    if (error === 'No QR code found') return;
    const li = document.createElement('li');
    li.textContent = error;
    li.style.color = 'red';
    resultList.insertBefore(li, resultList.firstChild);
  },
  highlightScanRegion: true,
  highlightCodeOutline: true,
});

const camList = document.getElementById('cam-list');
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
    [...existingCameras].forEach(camera => {
      // go ahead and remove all existing cameras to repopulate camera list
      camera.remove();
    });
    QrScanner.listCameras(true).then(cameras => cameras.forEach(camera => {
      const option = document.createElement('option');
      option.value = camera.id;
      option.text = camera.label;
      option.className = 'device-camera';
      camList.add(option);
    }));
  });
});

camList.addEventListener('change', event => {
  cameraScanner.setCamera(event.target.value);
});

document.getElementById('stop-camera').addEventListener('click', () => {
  if (cameraScanner) cameraScanner.stop();
});

document.getElementById('file-input').addEventListener('change', event => {
  const file = event.target.files[0];
  if (file) {
    QrScanner.scanImage(file, { returnDetailedScanResult: true }).then(result => handleQrCode(result));
  }
});

function handleQrCode(result) {
  if (!result || !result.bytes) return;
  
  cameraScanner.stop();

  const qrData = new Uint8Array(result.bytes);
  const decryptedData = decryptAesCcm(qrData.slice(0, 112)); // First 112 bytes are AES-CCM

  hexEditorBaseOutput.loadFromArray(decryptedData);
  document.getElementById('extra-data-warning').style.display = 'none';

  if (qrData.length > 112) {
    const iv = qrData.slice(112, 128);
    const encryptedExtra = qrData.slice(128, -4);
    decryptAesCtr(encryptedExtra, iv).then(decryptedExtraData => {
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

// Tab functionality
/*
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`).classList.add('active');
}
*/

document.getElementById('use-dev-key').addEventListener('change', event => {
  toggleAESCCMKeyMode(event.target.checked);
  console.log('current key: ' + gAESCCMKeyPrimary);
});

// AES-CCM Encryption (for Mii QR code data)
function encryptAesCcm(data) {
  // effectively changes birth platform to 3ds
  // if this is not set then the code
  // will not scan on 3ds (wiiu sets this)
  data[0x03] = 0x30; //'0'
  // Assuming sjcl.codec.bytes is properly defined
  let nonce = data.slice(12, 20);
  let content = [...data.slice(0, 12), ...data.slice(20)];

  let checksumContent = [...data.slice(0, 12), ...nonce, ...data.slice(20, -2)];
  let newChecksum = crc16(new Uint8Array(checksumContent));
  content = [...content.slice(0, -2), ...toByteArray(newChecksum)];

  const cipher = new sjcl.cipher.aes(gAESCCMKeyPrimary);

  let paddedContent = new Uint8Array([...content, ...new Array(8).fill(0)]);
  let paddedContentBits = sjcl.codec.bytes.toBits(Array.from(paddedContent));
  let nonceBits = sjcl.codec.bytes.toBits([...nonce, 0, 0, 0, 0]);

  let encryptedBits = sjcl.mode.ccm.encrypt(cipher, paddedContentBits, nonceBits, [], 128);
  let encryptedBytes = sjcl.codec.bytes.fromBits(encryptedBits);

  let correctEncryptedContentLength = encryptedBytes.length - 8 - 16;
  let encryptedContentCorrected = encryptedBytes.slice(0, correctEncryptedContentLength);
  let tag = encryptedBytes.slice(encryptedBytes.length - 16);

  let result = new Uint8Array([...nonce, ...encryptedContentCorrected, ...tag]);
  return result;
}

// AES-CTR Encryption (for extra data)
async function encryptAesCtr(data) {
  // Calls to SubtleCr*pto (window.cr*pto.subtle):
  const key = await sc.importKey('raw', hexToUint8Array(AES_CTR_KEY_HEX), { name: 'AES-CTR' }, false, ['encrypt']);
  // window.cr*pto.getRandomValues:
  const iv = crpyto.getRandomValues(new Uint8Array(16));

  const encrypted = await sc.encrypt({ name: 'AES-CTR', counter: iv, length: 128 }, key, data.buffer);
  return { encryptedData: new Uint8Array(encrypted), iv };
}

// Utility function to convert 16-bit checksum to byte array
function toByteArray(num) {
  return [(num >> 8) & 0xFF, num & 0xFF];
}

// Initialize QR Scanner
QrScanner.hasCamera().then(hasCamera => {
  if (!hasCamera) document.getElementById('start-camera').disabled = true;
  if (!hasCamera) document.getElementById('stop-camera').disabled = true;
});







// Constants for StoreData size
const STORE_DATA_MIN_SIZE = 72;
const STORE_DATA_MAX_SIZE = 96;

// Function to load StoreData from file
function loadStoreDataFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileSize = file.size;
  if (fileSize < STORE_DATA_MIN_SIZE || fileSize > STORE_DATA_MAX_SIZE) {
    alert(`StoreData (.cfsd) file must be between ${STORE_DATA_MIN_SIZE} and ${STORE_DATA_MAX_SIZE} bytes.`);
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    let baseData = new Uint8Array(e.target.result);
    
    // Pad StoreData to 96 bytes if it's less
    if (baseData.length < 96) {
      const paddedBaseData = new Uint8Array(96);
      paddedBaseData.set(baseData); // Copy original data
      baseData = paddedBaseData;    // Replace with padded data
    }

    // Load into the hex editor for base data (StoreData)
    hexEditorBaseInput.loadFromArray(baseData);
  };

  reader.readAsArrayBuffer(file);
}

// Function to load Extra Data from file
function loadExtraDataFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const extraData = new Uint8Array(e.target.result);
    
    // Load into the hex editor for extra data
    hexEditorExtraInput.loadFromArray(extraData);
    document.getElementById('hex-editor-decrypt-extra').style.display = 'initial';
  };

  reader.readAsArrayBuffer(file);
}