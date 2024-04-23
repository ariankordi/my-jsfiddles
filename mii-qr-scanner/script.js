// FOR LOGGING
function buf2hex(buffer) { // buffer is an ArrayBuffer
  return [...new Uint8Array(buffer)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}

function decryptAesCcm(encryptedData) {
	// if the length is smaller than the standard mii qr code size
	if(encryptedData.length < 112) {
  	throw new Error('Mii QR codes should be 112 or more bytes long, yours is ' + encryptedData.length);
  }
  // Extract nonce and encrypted content
  const nonce = encryptedData.slice(0, 8);
  const encryptedContent = encryptedData.slice(8);

  //const key = sjcl.codec.hex.toBits('59FC817E6446EA6190347B20E9BDCE52');
  // hardcoding the key, sjcl formats keys in these huge 32 bit ints
  const cipher = new sjcl.cipher.aes([1509720446, 1682369121, -1875608800, -373436846]);

  // Convert nonce and encrypted content to bits, adjusting the nonce to full size
  const encryptedBits = sjcl.codec.bytes.toBits(Array.from(encryptedContent));
  let nonceBits = sjcl.codec.bytes.toBits([...nonce, 0, 0, 0, 0]);

  // Isolate the actual ciphertext from the tag and adjust IV
  const tlen = 128; // Tag length in bits
  let out = sjcl.bitArray.clamp(encryptedBits,
    // remove tag from out, tag length = 128
    sjcl.bitArray.bitLength(encryptedBits) - tlen);

  // regex to find the _ctrMode function: 6 arguments and calls "bitSlice"
  const ctrModeFuncRegex = /\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*,[^)]*\)\s*.*?bitSlice/;

  // jsdelivr (1.0.8 sjcl.min.js) minifies this function name to "C"
  const ctrDecrypt = sjcl.mode.ccm._ctrMode || sjcl.mode.ccm.C ||
    // attempt to find the private _ctrMode func using our regex
    Object.entries(sjcl.mode.ccm).find(
      // match string representation of the function
      ([_, fn]) => fn.toString().match(ctrModeFuncRegex)
    )[1];
  // may throw IndexError??
  if (!ctrDecrypt) throw new Error('WE CANNOT FIND HIDDEN sjcl.mode.ccm._ctrMode DECRYPT FUNCTION!!!!!!');
  const decryptedBits = ctrDecrypt(cipher, out, nonceBits, [], tlen, 3) // harcoding 3 as "L" / length;
  // NOTE: the CBC-MAC of the qr code is NOT verified here
  // Construct the final output with nonce in the middle
  const decryptedBytes = sjcl.codec.bytes.fromBits(decryptedBits.data);
  const decryptedSlice = new Uint8Array(decryptedBytes).slice(0, 0x58);
  const finalResult = new Uint8Array([
    ...decryptedSlice.slice(0, 12),
    ...nonce,
    ...decryptedSlice.slice(12)
  ]);

  // Convert to base64 and log the output
  console.log("Decrypted Data (Base64):", btoa(String.fromCharCode.apply(null, finalResult)));
  console.log("Decrypted Data (Hex):", buf2hex(finalResult));
  return finalResult;
}


const base64ToUint8Array = base64 => new Uint8Array(Array.prototype.map.call(atob(base64), char => char.charCodeAt(0)));
const encrypted = base64ToUint8Array(`27iHMb5gKyrJDR5bsJCq9UuKpi8RL8opTDaYZ37t1ATAmf+ay8RvVR4PoejeWYAY5inDKZuIXRWdzuZjTtl722/pxGNhxTzH8WMtqlzrl0O73uR9PdAiygf7budKwA9bdt33oYsZcYD8C36brILv3Q==`);
console.log(decryptAesCcm(encrypted));





const fileInput = document.getElementById('file-input');
const video = document.getElementById('qr-video');
const resultList = document.getElementById('result-list');
const camList = document.getElementById('cam-list');

// Initialize QR Scanner
//QrScanner.WORKER_PATH = 'https://debian.local:8443/assets/qr-scanner-worker.min.js';
//const qrScanner = new QrScanner(video, result => handleDecryption(result));
const scanner = new QrScanner(video, result => handleDecryption(result), {
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

document.getElementById('start-camera').addEventListener('click', () => {
  scanner.start().then(() => {
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

document.getElementById('stop-button').addEventListener('click', () => {
  scanner.stop();
});

camList.addEventListener('change', event => {
  scanner.setCamera(event.target.value);
});

fileInput.addEventListener('change', event => {
  const file = event.target.files[0];
  if (file) {
    QrScanner.scanImage(file, {
        returnDetailedScanResult: true
      })
      .then(result => handleDecryption(result))
      .catch(error => console.error(error));
  }
});

function handleDecryption(result) {
	// QR CODE EMPTY or does not contain binary
	if(!result.bytes.length) {
  	const li = document.createElement('li');
    li.textContent = 'QR code is empty or does not have binary data.';
    li.style.color = 'red';
    resultList.insertBefore(li, resultList.firstChild);
  }
  const inputData = new Uint8Array(result.bytes);
 	let decryptedData;
  try {
	  decryptedData = decryptAesCcm(inputData); // Decrypt
  } catch(error) {
  	const li = document.createElement('li');
    li.textContent = error;
    li.style.color = 'red';
    resultList.insertBefore(li, resultList.firstChild);
  	return;
  }
  const base64Data = btoa(String.fromCharCode.apply(null, decryptedData)); // Convert Uint8Array to Base64
  const li = document.createElement('li');
  const pre = document.createElement('pre');
  pre.textContent = base64Data;
  li.style.color = getRandomPastelColor();
  // Extract UTF-16 LE Mii name starting at 0x1A
	const startOffset = 0x1A;
  // Find the position of the null terminator (0x00 0x00)
  let endPosition = startOffset;
  while (endPosition < decryptedData.length - 1) {
    if (decryptedData[endPosition] === 0x00 && decryptedData[endPosition + 1] === 0x00) {
      break;
    }
    endPosition += 2; // Move in 2-byte increments (UTF-16 LE)
  }
	const utf16leBytes = decryptedData.slice(0x1A, endPosition);
  let utf16leMiiName = new TextDecoder('utf-16le').decode(utf16leBytes);
  
  // crc16 verify
  const dataCrc16 = decryptedData.slice(-2);
  // convert the decrypted qr crc16 to uint16
  const dataCrc16u16 = (dataCrc16[0] << 8) | dataCrc16[1];
	
  // now calculate the expected crc16 for the data
  const expectedCrc16 = crc16(decryptedData.slice(0, -2));
  
  if(expectedCrc16 != dataCrc16u16) {
  	utf16leMiiName = 'CHECKSUM FAILED:' + utf16leMiiName;
    li.style.color = 'red';
  }
  utf16leMiiName && (li.textContent = utf16leMiiName);
  li.appendChild(pre);
  
  resultList.insertBefore(li, resultList.firstChild);

  // TODO: AFTER VERIFICATION...
  // finished, stop camera if it is open
  scanner.stop();
}

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

function getRandomPastelColor() {
  const mix = [255, 255, 224]; // Light yellow will help in making pastel colors
  const base = [Math.random() * 256, Math.random() * 256, Math.random() * 256];
  const pastel = base.map((val, index) => Math.round((val + mix[index]) / 2));
  return `rgb(${pastel.join(', ')})`;
}