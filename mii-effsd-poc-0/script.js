// Constant for fixed size of the data
const CFLI_PACKED_MII_DATA_CORE_SIZE = 72 // 72 bytes
// Helper function to convert a hex string to a byte array
function hexStringToByteArray(hexString) {
  // Remove any whitespace and split the string into pairs of hex digits
  hexString = hexString.replace(/\s+/g, "")
  let bytes = []
  for (let i = 0; i < hexString.length; i += 2) {
    bytes.push(parseInt(hexString.substr(i, 2), 16))
  }
  return bytes
}

// Helper function to convert a byte array to a hex string
function byteArrayToHexString(byteArray) {
  // Convert each byte to a 2-digit hex string and join them together
  return Array.from(byteArray, function (byte) {
    return ("0" + (byte & 0xff).toString(16)).slice(-2)
  }).join("")
}

// Define the padding fields with their positions and sizes
const paddingFields = [
  { byteOffset: 1, bitOffset: 6, size: 2 }, // reserved_0:2
  { byteOffset: 3, bitOffset: 7, size: 1 }, // reserved_1:1
  { byteOffset: 22, bitOffset: 0, size: 8 }, // reserved_2[0]:8 bits
  { byteOffset: 23, bitOffset: 0, size: 8 }, // reserved_2[1]:8 bits
  { byteOffset: 25, bitOffset: 7, size: 1 }, // padding_0:1
  { byteOffset: 51, bitOffset: 4, size: 4 }, // padding_1:4
  { byteOffset: 55, bitOffset: 6, size: 2 }, // padding_2:2
  { byteOffset: 57, bitOffset: 7, size: 1 }, // padding_3:1
  { byteOffset: 59, bitOffset: 6, size: 2 }, // padding_4:2
  { byteOffset: 61, bitOffset: 6, size: 2 }, // padding_5:2
  { byteOffset: 65, bitOffset: 0, size: 8 }, // padding_6:8
  { byteOffset: 67, bitOffset: 7, size: 1 }, // padding_7:1
  { byteOffset: 71, bitOffset: 7, size: 1 }, // padding_8:1
]

/**
 * Read bits from a DataView at the specified bit position
 * @param {DataView} dataView - The DataView containing the data
 * @param {number} byteOffset - The byte offset in the DataView
 * @param {number} bitOffset - The bit offset within the byte
 * @param {number} numBits - The number of bits to read
 * @returns {number} The extracted bits as a number
 */
function readBits(dataView, byteOffset, bitOffset, numBits) {
  let value = 0
  let shift = 0
  while (numBits > 0) {
    const currentByte = dataView.getUint8(byteOffset)
    const bitsLeftInByte = 8 - bitOffset
    const bitsToRead = Math.min(numBits, bitsLeftInByte)
    const mask = ((1 << bitsToRead) - 1) << bitOffset
    const extractedBits = (currentByte & mask) >> bitOffset
    value |= extractedBits << shift
    shift += bitsToRead
    numBits -= bitsToRead
    bitOffset += bitsToRead
    if (bitOffset >= 8) {
      bitOffset = 0
      byteOffset += 1
    }
  }
  return value
}

/**
 * Write bits to a DataView at the specified bit position
 * @param {DataView} dataView - The DataView to write to
 * @param {number} byteOffset - The byte offset in the DataView
 * @param {number} bitOffset - The bit offset within the byte
 * @param {number} numBits - The number of bits to write
 * @param {number} value - The value to write
 */
function writeBits(dataView, byteOffset, bitOffset, numBits, value) {
  let shift = 0
  while (numBits > 0) {
    const bitsLeftInByte = 8 - bitOffset
    const bitsToWrite = Math.min(numBits, bitsLeftInByte)
    const mask = ((1 << bitsToWrite) - 1) << bitOffset
    let currentByte = dataView.getUint8(byteOffset)
    currentByte &= ~mask // Clear the bits we are going to write
    currentByte |= ((value >> shift) & ((1 << bitsToWrite) - 1)) << bitOffset
    dataView.setUint8(byteOffset, currentByte)
    shift += bitsToWrite
    numBits -= bitsToWrite
    bitOffset += bitsToWrite
    if (bitOffset >= 8) {
      bitOffset = 0
      byteOffset += 1
    }
  }
}

/**
 * Extract padding fields from the data
 * @param {Array<number>} data - The data as an array of bytes
 * @returns {Array<number>} The extracted padding data as an array of bytes
 */
function extractPadding(data) {
  let bitPos = 0
  let bits = 0n // Use BigInt to handle large bit sizes
  const dataView = new DataView(new Uint8Array(data).buffer)

  for (let field of paddingFields) {
    const value = readBits(
      dataView,
      field.byteOffset,
      field.bitOffset,
      field.size,
    )
    bits |= BigInt(value) << BigInt(bitPos)
    bitPos += field.size
  }

  const totalBytes = Math.ceil(bitPos / 8)
  const output = []
  for (let i = 0; i < totalBytes; i++) {
    output.push(Number((bits >> BigInt(i * 8)) & 0xffn))
  }

  return output
}

/**
 * Write padding data into the data
 * @param {Array<number>} data - The original data as an array of bytes
 * @param {Array<number>} paddingData - The padding data to insert as an array of bytes
 * @returns {Uint8Array} The modified data with padding inserted
 */
function writePadding(data, paddingData) {
  let bitPos = 0
  let bits = 0n

  for (let i = 0; i < paddingData.length; i++) {
    bits |= BigInt(paddingData[i]) << BigInt(i * 8)
  }

  const dataView = new DataView(new Uint8Array(data).buffer)

  for (let field of paddingFields) {
    const value = Number(
      (bits >> BigInt(bitPos)) & BigInt((1 << field.size) - 1),
    )
    writeBits(dataView, field.byteOffset, field.bitOffset, field.size, value)
    bitPos += field.size
  }

  return new Uint8Array(dataView.buffer)
}

// Ensure data length matches the fixed size
function normalizeDataLength(data) {
  if (data.length > CFLI_PACKED_MII_DATA_CORE_SIZE) {
    return data.slice(0, CFLI_PACKED_MII_DATA_CORE_SIZE)
  } else if (data.length < CFLI_PACKED_MII_DATA_CORE_SIZE) {
    return data.concat(
      new Array(CFLI_PACKED_MII_DATA_CORE_SIZE - data.length).fill(0),
    )
  }
  return data
}

// Event listener for encoding form
document.getElementById("encodeForm").addEventListener("submit", function (e) {
  e.preventDefault()

  const data = normalizeDataLength(
    hexStringToByteArray(document.getElementById("dataEncode").value),
  )
  const paddingData = hexStringToByteArray(
    document.getElementById("paddingData").value,
  )
  const modifiedData = writePadding(data, paddingData)

  document.getElementById("encodeResult").innerText =
    "Modified Data (Hex): " + byteArrayToHexString(modifiedData)
})

// Event listener for decoding form
document.getElementById("decodeForm").addEventListener("submit", function (e) {
  e.preventDefault()

  const data = normalizeDataLength(
    hexStringToByteArray(document.getElementById("dataDecode").value),
  )
  const extractedPadding = extractPadding(data)

  document.getElementById("decodeResult").innerText =
    "Extracted Padding Data (Hex): " + byteArrayToHexString(extractedPadding)
})
