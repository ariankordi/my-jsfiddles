// Add the CRC16 function, AES encryption, and the rest of the logic here
function crc16(data) {
  let crc = 0;
  let msb = crc >> 8;
  let lsb = crc & 0xFF;

  for (let i = 0; i < data.length; i++) {
    let c = data[i];
    let x = c ^ msb;
    x ^= (x >> 4);
    msb = (lsb ^ (x >> 3) ^ (x << 4)) & 0xFF;
    lsb = (x ^ (x << 5)) & 0xFF;
  }

  crc = (msb << 8) + lsb;
  return crc;
}

function toByteArray(num) {
  return [(num >> 8) & 0xFF, num & 0xFF];
}

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

  let key = sjcl.codec.hex.toBits('59FC817E6446EA6190347B20E9BDCE52');
  let cipher = new sjcl.cipher.aes(key);

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

// happens when form is submitted
function processData(event) {
  event.preventDefault();

  const fileInput = document.getElementById('fileInput');
  const miiDataInput = document.getElementById('miiDataInput');
  const reader = new FileReader();

  reader.onload = function(e) {
    processAndDisplayQR(new Uint8Array(e.target.result));
  };

  if (fileInput.files.length > 0) {
    reader.readAsArrayBuffer(fileInput.files[0]);
  } else if (miiDataInput.value.trim() !== '') {
    const decodedData = Uint8Array.from(atob(miiDataInput.value), c => c.charCodeAt(0));
    processAndDisplayQR(decodedData);
  } else {
    alert("Please provide a file or Base64 Mii data.");
    return;
  }

  // Clear the input fields
  fileInput.value = '';
  miiDataInput.value = '';
}

function processAndDisplayQR(data) {

  const encrypted = encryptAesCcm(data);
  const qr = QRCode.generateHTML(Array.from(encrypted));
  // adding a random color caused issues with scanning, sometimes worked sometimes no
  /*const color = getRandomPastelColor();

  // Modify the QR code table background color
  qr.querySelector('table').style.backgroundColor = color;*/
  const li = document.createElement('li');

  // Extract UTF-16 LE Mii name starting at 0x1A
	const startOffset = 0x1A;
  const nameLength = 0x14;
  // Find the position of the null terminator (0x00 0x00)
  let endPosition = startOffset;
  while (endPosition < startOffset + nameLength) {
    if (data[endPosition] === 0x00 && data[endPosition + 1] === 0x00) {
      break;
    }
    endPosition += 2; // Move in 2-byte increments (UTF-16 LE)
  }
	const utf16leBytes = data.slice(0x1A, endPosition);
  const utf16leMiiName = new TextDecoder('utf-16le').decode(utf16leBytes);
  utf16leMiiName && (li.textContent = utf16leMiiName);

  li.appendChild(qr);
  const qrList = document.getElementById('qrList');
  qrList.insertBefore(li, qrList.firstChild); // Add to the top
}
/*function getRandomPastelColor() {
  const mix = [255, 255, 224]; // Light yellow will help in making pastel colors
  const base = [Math.random() * 256, Math.random() * 256, Math.random() * 256];
  const pastel = base.map((val, index) => Math.round((val + mix[index]) / 2));
  return `rgb(${pastel.join(', ')})`;
}*/