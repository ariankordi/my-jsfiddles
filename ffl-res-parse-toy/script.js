// @ts-check
// import * as _ from './struct-fu.js';
/* eslint @stylistic/indent: ['error', 2] -- Define indent rules. */
/* eslint @stylistic/spaced-comment: ['error', 'always', {
    line: { markers: ['/<', '!<'] },
    block: { markers: ['*'], balanced: true }
  }],
  @stylistic/no-multi-spaces: 'off'
  -- Allow Doxygen-style inline brief comments.
*/

// import { unzipSync } from 'fflate';
// const fflate = { unzipSync };
// import * as _Import from './struct-fu.js';
/* globals _ -- Global dependencies. */
/** @typedef {import('./struct-fu')} _ */
// eslint-disable-next-line no-self-assign -- Get TypeScript to identify global imports.
globalThis._ = /** @type {_} */ (/** @type {*} */ (globalThis)._);
// eslint-disable-next-line @stylistic/max-statements-per-line --  Hack to use either UMD or browser ESM import.
// let _ = globalThis._; _ = (!_) ? _Import : _;


// Constants for resource header magic.
const FFLI_RESOURCE_HEADER_MAGIC_BE = 'FFRA';
const FFLI_RESOURCE_HEADER_MAGIC_LE = 'ARFF';
const FFLI_RESOURCE_HEADER_MAGIC_U32 = 0x46465241;
// This sample tries? to detect endianness from the magic.
const FFLI_RESOURCE_HEADER_EXPAND_BUFFER_SIZE_OFFSET = 0x0c;
const FFLI_RESOURCE_HEADER_EXPAND_BUFFER_SIZE_AFL_2_3 = 0x2502de0;
const FFLI_RESOURCE_HEADER_RESOURCE_TYPE_HINT_AFL_2_3 = 3;

// // ---------------------------------------------------------------------
// //  JSDoc Struct Definitions
// // ---------------------------------------------------------------------

/**
 * Structure making up each texture and shape element.
 * @typedef {Object} FFLiResourcePartsInfo
 * @property {number} dataPos - Offset of the data in the resource file.
 * @property {number} dataSize
 * @property {number} compressedSize
 * @property {number} compressLevel - enum FFLiResourceCompressLevel
 * @property {number} windowBits - enum FFLiResourceWindowBits
 * @property {number} memoryLevel - enum FFLiResourceMemoryLevel
 * @property {number} strategy - enum FFLiResourceStrategy
 * @todo ACCURACY?: see DWARF for nn::mii::detail::ResourceCommonAttribute
 */

/**
 * Texture header accounting for either AFLResHigh_2_3.dat or FFLResHigh.dat.
 * @typedef {Object} FFLiResourceTextureHeader
 * @property {Array<number>} partsMaxSize
 * @property {Array<FFLiResourcePartsInfo>} partsInfoBeard
 * @property {Array<FFLiResourcePartsInfo>} partsInfoCap
 * @property {Array<FFLiResourcePartsInfo>} partsInfoEye
 * @property {Array<FFLiResourcePartsInfo>} partsInfoEyebrow
 * @property {Array<FFLiResourcePartsInfo>} partsInfoFaceline
 * @property {Array<FFLiResourcePartsInfo>} partsInfoFaceMakeup
 * @property {Array<FFLiResourcePartsInfo>} partsInfoGlass
 * @property {Array<FFLiResourcePartsInfo>} partsInfoMole
 * @property {Array<FFLiResourcePartsInfo>} partsInfoMouth
 * @property {Array<FFLiResourcePartsInfo>} partsInfoMustache
 * @property {Array<FFLiResourcePartsInfo>} partsInfoNoseline
 * @todo ACCURACY?: see DWARF for nn::mii::detail::ResourceTextureHeader
 */

/**
 * @enum {number}
 */
const FFLTextureFormat = {
  R8_UNORM: 0,
  R8_G8_UNORM: 1,
  R8_G8_B8_A8_UNORM: 2,
  MAX: 3
};
/**
 * @typedef {Object} FFLiResourceTextureFooter
 * @property {number} m_MipOffset
 * @property {number} m_Width
 * @property {number} m_Height
 * @property {number} m_NumMips
 * @property {FFLTextureFormat} m_TextureFormat
 */

/**
 * Shape header, same across all FFL and AFL resources.
 * Using Normal/Cap naming from my fork: https://github.com/ariankordi/ffl/commit/3c38d160c12e8384c4a752296c8422a9d98377c1
 * @typedef {Object} FFLiResourceShapeHeader
 * @property {Array<number>} partsMaxSize
 * @property {Array<FFLiResourcePartsInfo>} partsInfoBeard
 * @property {Array<FFLiResourcePartsInfo>} partsInfoHatNormal
 * @property {Array<FFLiResourcePartsInfo>} partsInfoHatCap
 * @property {Array<FFLiResourcePartsInfo>} partsInfoFaceline
 * @property {Array<FFLiResourcePartsInfo>} partsInfoGlass
 * @property {Array<FFLiResourcePartsInfo>} partsInfoMask
 * @property {Array<FFLiResourcePartsInfo>} partsInfoNoseline
 * @property {Array<FFLiResourcePartsInfo>} partsInfoNose
 * @property {Array<FFLiResourcePartsInfo>} partsInfoHairNormal
 * @property {Array<FFLiResourcePartsInfo>} partsInfoHairCap
 * @property {Array<FFLiResourcePartsInfo>} partsInfoForeheadNormal
 * @property {Array<FFLiResourcePartsInfo>} partsInfoForeheadCap
 */

/**
 * @enum {number}
 */
const FFLiResourceShapeElementType = {
  /**
   * Vertex position, stored as three 32-bit floating point values.
   * Padded with four zero bytes (stride = 16).
   */
  POSITION: 0,
  /**
   * Normal vector, encoded as 10-bit signed normalized integers
   * with a 2-bit alpha component (10_10_10_2_SNORM, stride = 4).
   */
  NORMAL: 1,
  /** Texture coordinates (UV mapping), stored as two 32-bit floating point values (stride = 8). */
  TEXCOORD: 2,
  /** Tangent vector, stored as four signed 8-bit normalized values (stride = 4). */
  TANGENT: 3,
  /** Vertex color, stored as four unsigned 8-bit normalized values (RGBA, stride = 4). */
  COLOR: 4,
  /** Vertex index, stored as an unsigned 16-bit integer. */
  INDEX: 5,

  /**
   * Transform data for hair, parsed as {@link FFLiResourceShapeHairTransform}.
   * Only used for setting FFLPartsTransform/for headwear.
   */
  TRANSFORM_HAIR_1: 6,
  /** Transform data for faceline, parsed as {@link FFLiResourceShapeFacelineTransform}. */
  TRANSFORM_FACELINE: 7,
  /**
   * Bounding box, represented using the `FFLBoundingBox` structure,
   * which consists of minimum and maximum 3D coordinates.
   */
  BOUNDING_BOX: 8,

  BUFFER_MAX: 6
};

/**
 * @typedef {Object} FFLVec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */
/**
 * @typedef {{min: FFLVec3, max: FFLVec3}} FFLBoundingBox
 * @property {FFLVec3} min
 * @property {FFLVec3} max
 */
/**
 * @typedef {Object} FFLiResourceShapeFacelineTransform
 * @property {FFLVec3} hairTranslate
 * @property {FFLVec3} noseTranslate
 * @property {FFLVec3} beardTranslate
 */
/**
 * @typedef {Object} FFLiResourceShapeHairTransform
 * @property {FFLVec3} frontTranslate
 * @property {FFLVec3} frontRotate
 * @property {FFLVec3} sideTranslate
 * @property {FFLVec3} sideRotate
 * @property {FFLVec3} topTranslate
 * @property {FFLVec3} topRotate
 * @todo TODO: Include FFLPartsTransform as well?
 * NOTE!!!: that the only purpose of this is to fill in
 * FFLPartsTransform, making it not completely needed for rendering.
 */
/**
 * @typedef {Object} FFLiResourceShapeDataHeader
 * @property {Array<number>} m_ElementPos - Size: {@link FFLiResourceShapeElementType.BUFFER_MAX}
 * @property {Array<number>} m_ElementSize - Size: {@link FFLiResourceShapeElementType.BUFFER_MAX}
 * @property {FFLBoundingBox} m_BoundingBox - {@link FFLiResourceShapeElementType.BOUNDING_BOX}
 * @property {Array<number>} m_Transform - NOTE: Interpret this as
 * either none, {@link FFLiResourceShapeFacelineTransform}, or {@link FFLiResourceShapeHairTransform}.
 */

/**
 * Top-level resource header.
 * @typedef {Object} FFLiResourceHeader
 * @property {number} m_Magic - "FFRA" fourcc.
 * @property {number} m_Version
 * @property {number} m_UncompressBufferSize
 * @property {number} m_ExpandBufferSize
 * @property {number} m_IsExpand
 * @property {FFLiResourceTextureHeader} m_TextureHeader
 * @property {FFLiResourceShapeHeader} m_ShapeHeader
 * @property {Array<number>} _49d0 - Completely unused field.
 * @todo ACCURACY?: no analog in nn::mii but there's DWARF for ResourceShapeHeader/ResourceTextureHeader
 */

/* eslint-disable jsdoc/require-returns-type -- Guess the return type. */
/**
 * Initializes FFLiResource* structures with struct-fu, returning the structs as an object.
 * @param {boolean} littleEndian - If true, parse the structures in little-endian, otherwise use big-endian.
 * @param {boolean} isAFL_2_3TextureHeader - If true, parse the structs using the texture header specification for AFLResHigh_2_3.dat.
 * @returns An object containing FFLiResource* structures configured with the endianness provided.
 */
const createFFLiResourceStructs = (littleEndian, isAFL_2_3TextureHeader) => {
  /* eslint-enable jsdoc/require-returns-type -- Guess the return type. */
  /**
   * uint32 but endian-specific. Meant for this context only.
   * @todo TODO: better name (uint32 -> uint32be then make uint32 general?)
   * or TODO: into struct-fu in general? per-struct or global?
   */
  const uint32bi = littleEndian ? _.uint32le : _.uint32;
  /** uint16 but endian-specific. */
  const uint16bi = littleEndian ? _.uint16le : _.uint16;
  /** float32 but endian-specific. */
  const float32bi = littleEndian ? _.float32le : _.float32;

  // The structs below are based off of the FFL decomp by AboodXD: https://github.com/aboood40091/ffl/blob/0fe8e687dac5963000e3214a2c54d9219c99d63f/include/nn/ffl/FFLiResourceHeader.h

  /** @type {import('./struct-fu').StructInstance<FFLiResourcePartsInfo>} */
  const FFLiResourcePartsInfo = _.struct([
    uint32bi('dataPos'),
    uint32bi('dataSize'),
    uint32bi('compressedSize'),
    _.uint8('compressLevel'),
    _.uint8('windowBits'),
    _.uint8('memoryLevel'),
    _.uint8('strategy')
  ]);

  /** @type {import('./struct-fu').StructInstance<FFLiResourceTextureHeader>} */
  const FFLiResourceTextureHeader = (() => {
    /** Anonymous alias for isAFL_2_3TextureHeader. */
    const afl = isAFL_2_3TextureHeader;
    return _.struct([
      uint32bi('partsMaxSize', 11),
      _.struct('partsInfoBeard', [FFLiResourcePartsInfo], 3),
      _.struct('partsInfoCap', [FFLiResourcePartsInfo], 132),
      // Modify counts for eye, eyebrow, glass, mouth
      // based on whether the resource is from AFLResHigh_2_3.dat.
      _.struct('partsInfoEye', [FFLiResourcePartsInfo], afl ? 80 : 62),
      _.struct('partsInfoEyebrow', [FFLiResourcePartsInfo], afl ? 28 : 24),
      _.struct('partsInfoFaceline', [FFLiResourcePartsInfo], 12),
      _.struct('partsInfoFaceMakeup', [FFLiResourcePartsInfo], 12),
      _.struct('partsInfoGlass', [FFLiResourcePartsInfo], afl ? 20 : 9),
      _.struct('partsInfoMole', [FFLiResourcePartsInfo], 2),
      _.struct('partsInfoMouth', [FFLiResourcePartsInfo], afl ? 52 : 37),
      _.struct('partsInfoMustache', [FFLiResourcePartsInfo], 6),
      _.struct('partsInfoNoseline', [FFLiResourcePartsInfo], 18)
    ]);
  })();

  // For each texture PartsInfo, the data is the texture data with the last
  // 12 bytes (= FFLiResourceTextureFooter.size) corresponding to FFLiResourceTextureFooter:
  // Gets read here: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/src/detail/FFLiResourceTexture.cpp#L24

  /** @type {import('./struct-fu').StructInstance<FFLiResourceTextureFooter>} */
  const FFLiResourceTextureFooter = _.struct([
    uint32bi('m_MipOffset'),
    uint16bi('m_Width'),
    uint16bi('m_Height'),
    _.uint8('m_NumMips'),
    _.uint8('m_TextureFormat'),
    _.byte('_padding', 2) // Includes two bytes of padding.
  ]);

  /** @type {import('./struct-fu').StructInstance<FFLiResourceShapeHeader>} */
  const FFLiResourceShapeHeader = _.struct([
    uint32bi('partsMaxSize', 12),
    _.struct('partsInfoBeard', [FFLiResourcePartsInfo], 4),
    _.struct('partsInfoHatNormal', [FFLiResourcePartsInfo], 132),
    _.struct('partsInfoHatCap', [FFLiResourcePartsInfo], 132),
    _.struct('partsInfoFaceline', [FFLiResourcePartsInfo], 12),
    _.struct('partsInfoGlass', [FFLiResourcePartsInfo], 1),
    _.struct('partsInfoMask', [FFLiResourcePartsInfo], 12),
    _.struct('partsInfoNoseline', [FFLiResourcePartsInfo], 18),
    _.struct('partsInfoNose', [FFLiResourcePartsInfo], 18),
    _.struct('partsInfoHairNormal', [FFLiResourcePartsInfo], 132),
    _.struct('partsInfoHairCap', [FFLiResourcePartsInfo], 132),
    _.struct('partsInfoForeheadNormal', [FFLiResourcePartsInfo], 132),
    _.struct('partsInfoForeheadCap', [FFLiResourcePartsInfo], 132)
  ]);

  // For each shape PartsInfo, the data is FFLiResourceShapeDataHeader:
  // Gets read here: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/src/detail/FFLiResourceShape.cpp#L19

  /** @type {import('./struct-fu').StructInstance<FFLVec3>} */
  const FFLVec3 = _.struct([
    float32bi('x'),
    float32bi('y'),
    float32bi('z')
  ]);

  /** @type {import('./struct-fu').StructInstance<FFLiResourceShapeFacelineTransform>} */
  const FFLiResourceShapeFacelineTransform = _.struct([
    _.struct('m_HairTranslate', [FFLVec3]),
    _.struct('m_NoseTranslate', [FFLVec3]),
    _.struct('m_BeardTranslate', [FFLVec3])
  ]);
  /** @type {import('./struct-fu').StructInstance<FFLiResourceShapeHairTransform>} */
  const FFLiResourceShapeHairTransform = _.struct([
    _.struct('m_FrontTranslate', [FFLVec3]),
    _.struct('m_FrontRotate', [FFLVec3]),
    _.struct('m_SideTranslate', [FFLVec3]),
    _.struct('m_SideRotate', [FFLVec3]),
    _.struct('m_TopTranslate', [FFLVec3]),
    _.struct('m_TopRotate', [FFLVec3])
  ]);

  /** @type {import('./struct-fu').StructInstance<FFLBoundingBox>} */
  const FFLBoundingBox = _.struct([
    _.struct('min', [FFLVec3]),
    _.struct('max', [FFLVec3])
  ]);

  const FFLiResourceShapeDataHeader = _.struct([
    uint32bi('m_ElementPos', FFLiResourceShapeElementType.BUFFER_MAX),
    uint32bi('m_ElementSize', FFLiResourceShapeElementType.BUFFER_MAX),
    _.struct('m_BoundingBox', [FFLBoundingBox]),
    float32bi('m_Transform', FFLiResourceShapeHairTransform.size / 4)
  ]);

  // Define top-level resource header structure.
  /** @type {import('./struct-fu').StructInstance<FFLiResourceHeader>} */
  const FFLiResourceHeader = _.struct([
    uint32bi('m_Magic'),
    uint32bi('m_Version'),
    uint32bi('m_UncompressBufferSize'),
    uint32bi('m_ExpandBufferSize'),
    uint32bi('m_IsExpand'),
    _.struct('m_TextureHeader', [FFLiResourceTextureHeader]),
    _.struct('m_ShapeHeader', [FFLiResourceShapeHeader]),
    uint32bi('_49d0', 12) // Unknown. Unused in FFL for NSMBU.
  ]);

  // Export struct definitions.
  return {
    FFLiResourceHeader,
    // Footer/header for each part type.
    FFLiResourceTextureFooter,
    FFLiResourceShapeDataHeader,
    FFLiResourceShapeFacelineTransform,
    FFLiResourceShapeHairTransform
  };
};

/**
 * @param {ArrayBuffer} buffer - The input ArrayBuffer to read the first 4 bytes of.
 * @returns {string} The first 4 characters of the input, or the magic/fourcc.
 */
const getMagicFromArrayBuffer = buffer => String.fromCharCode(
  // Read buffer as Uint8Array, get first 4 bytes as string.
  ...new Uint8Array(buffer).subarray(0, 4));

/**
 * Checks the magic of the resource to verify it
 * and return whether it is little-endian.
 * @param {ArrayBuffer} buffer - The ArrayBuffer for the resource. This will read the first 4 bytes.
 * @returns {boolean} Returns the value for if the resource is little-endian.
 * @throws {Error} Throws if magic does not match FFL resource.
 */
function getValidAndIsLittleEndianFromMagic(buffer) {
  // Peek at the magic to verify it and determine endianness.
  const magic = getMagicFromArrayBuffer(buffer);
  console.log(`🫣 peeked at magic: "${magic}"`);

  // Determine endianness based on the value of magic.
  if (magic === FFLI_RESOURCE_HEADER_MAGIC_BE) {
    console.log('🔧 parsing in big-endian...');
    return false;
  } else if (magic === FFLI_RESOURCE_HEADER_MAGIC_LE) {
    console.log('🦴 parsing in little-endian...');
    return true;
  } else {
    throw new Error(`unknown magic ("${magic}"), not an FFL resource`);
  }
}

/**
 * Determines whether a resource is using the
 * AFLResHigh_2_3.dat header from its buffer data.
 * @param {ArrayBuffer} resBuffer - The resource header.
 * @param {boolean} littleEndian - Endianness of the header.
 * @returns {boolean} Whether the resource is AFLResHigh_2_3.dat.
 */
function getIsAFL_2_3Header(resBuffer, littleEndian) {
  const view = new DataView(resBuffer);
  // Get m_ExpandBufferSize property, this is the only field that varies.
  const expandBufferSize = view.getUint32(FFLI_RESOURCE_HEADER_EXPAND_BUFFER_SIZE_OFFSET, littleEndian);
  // Return if the size matches that of the AFLResHigh_2_3.dat file.
  if (expandBufferSize === FFLI_RESOURCE_HEADER_EXPAND_BUFFER_SIZE_AFL_2_3) {
    return true;
  }
  // NOTE: Not accounting for AFLResHigh.dat.
  const hint = expandBufferSize >> 29;  ///< Get the first 3 bits.
  // Determine if it is AFLResHigh_2_3.dat from the hint here.
  return (hint === FFLI_RESOURCE_HEADER_RESOURCE_TYPE_HINT_AFL_2_3);
}

// // ---------------------------------------------------------------------
// //  Primary Entrypoint
// // ---------------------------------------------------------------------

/**
 * Sample for parsing and reading an FFL resource from an ArrayBuffer.
 * @param {ArrayBuffer} resArrayBuffer - The contents of the resource file.
 */
async function readResourceSample(resArrayBuffer) {
  // console.log('📁 resArrayBuffer:', resArrayBuffer); // NOTE: Memory leak, remove in prod.
  if (!(resArrayBuffer instanceof ArrayBuffer)) {
    throw new Error('readResourceSample: Expected resArrayBuffer to be ArrayBuffer.');
  }

  // Verify the magic of the resource and determine its endianness.
  const littleEndian = getValidAndIsLittleEndianFromMagic(resArrayBuffer);
  const isAFL_2_3 = getIsAFL_2_3Header(resArrayBuffer, littleEndian);
  // Construct structs with specified endianness.
  const s = createFFLiResourceStructs(littleEndian, isAFL_2_3);

  // Parse FFLiResourceHeader to object.
  const header = s.FFLiResourceHeader.unpack(resArrayBuffer);
  console.log('✅ FFLiResourceHeader.unpack result:', header);
  if (header.m_Magic !== FFLI_RESOURCE_HEADER_MAGIC_U32) {
    // Print real and expected magic both in hex (base 16).
    throw new Error(`❌ failed to parse magic, got: 0x${header.m_Magic.toString(16)}, expected: 0x${FFLI_RESOURCE_HEADER_MAGIC_U32.toString(16)}`);
  }

  // Extract m_ExpandBufferSize/total uncompressed resource size.
  const expandBufferSizeWithoutResHint = header.m_ExpandBufferSize & 0x1FFFFFFF; // only last 29 bits, see FFLiResourceUtil.cpp
  const totalUncompressedResSizeMB = Math.trunc(expandBufferSizeWithoutResHint / (1024 * 1024));

  if (totalUncompressedResSizeMB > 75) {
    // Assert if the resource is suspiciously large, assuming the number was read wrong.
    console.error(`🤨 you sure this resource is ${totalUncompressedResSizeMB} MB large?`);
  }

  console.log(`ℹ️ resource total uncompressed size: ${totalUncompressedResSizeMB} MB`);
  console.log('🖼️ m_TextureHeader:', header.m_TextureHeader);
  console.log('📐 m_ShapeHeader:', header.m_ShapeHeader);

  // Potential TODO: I feel that these methods could be made more generic,
  // so that completely different resource files could share the same interface.
  // Example: if it could just get part type/index; getting
  // its corresponding data, all structures just unpacked... Need to expand that.

  /**
   * Takes an {@link FFLiResourcePartsInfo} object within {@link FFLiResourceHeader},
   * reading and potentially decompressing the data
   * @param {ArrayBuffer} resArrayBuffer - The resource to read the part data from.
   * @param {FFLiResourcePartsInfo} partsInfo - The information about the part.
   * @returns {Promise<ArrayBuffer>} The decompressed part data.
   * @throws {Error} Throws if CompressionStream is not supported.
   */
  async function getPartsInfoData(resArrayBuffer, partsInfo) {
    // Access the compressed data for the part.
    const resU8 = new Uint8Array(resArrayBuffer);
    const rawData = resU8.subarray(partsInfo.dataPos,
      partsInfo.dataPos + partsInfo.compressedSize);

    // Check the compression strategy of the part.
    if (partsInfo.strategy === 5) { // FFLI_RESOURCE_STRATEGY_UNCOMPRESSED
      return rawData.buffer; ///< Return raw data directly. if uncompressed.
    }

    // Throw if CompressionStream is not supported.
    if (!window.CompressionStream) {
      throw new Error('getPartsInfoData: CompressionStream is not supported in this browser, so this function will have to be refactored to use pako library and call deflate().');
    }
    const cs = new DecompressionStream('deflate');
    const stream = /** @type {ReadableStream<Uint8Array>} */ (new Response(rawData).body)
      .pipeThrough(cs);
    const decompressed = await new Response(stream).arrayBuffer();

    return decompressed;
  }
  /**
   * @param {Uint8Array} data - The decompressed texture data.
   * @param {ReturnType<createFFLiResourceStructs>} s - Structures to use.
   * @returns {FFLiResourceTextureFooter} The texture footer.
   */
  const getTextureFooter = (data, s) =>
    s.FFLiResourceTextureFooter.unpack(data.subarray(-s.FFLiResourceTextureFooter.size));
  /**
   * @param {Uint8Array} data - The decompressed shape data.
   * @param {ReturnType<createFFLiResourceStructs>} s - Structures to use.
   * @returns {FFLiResourceShapeDataHeader} The shape data header.
   */
  const getShapeHeader = (data, s) =>
    s.FFLiResourceShapeDataHeader.unpack(data.subarray(0, s.FFLiResourceShapeDataHeader.size));
  /**
   * @param {Uint8Array} data - The decompressed shape data.
   * @param {ReturnType<createFFLiResourceStructs>} s - Structures to use.
   * @returns {FFLiResourceShapeFacelineTransform} The faceline transform object.
   */
  function getFacelineTransform(data, s) {
    const off = /** @type {number} */ (s.FFLiResourceShapeDataHeader.fields.m_Transform.offset);
    const buf = data.subarray(off, off + s.FFLiResourceShapeFacelineTransform.size);
    return s.FFLiResourceShapeFacelineTransform.unpack(buf);
  }

  // Get data and footer for eye 0.
  const eye0Data = new Uint8Array(await getPartsInfoData(resArrayBuffer, header.m_TextureHeader.partsInfoEye[0]));
  const eye0Footer = getTextureFooter(eye0Data, s);
  console.log('👁️📩 eye 0 footer: ', eye0Footer);

  // Get data and header for faceline 0.
  const faceline0Data = new Uint8Array(await getPartsInfoData(resArrayBuffer, header.m_ShapeHeader.partsInfoFaceline[0]));
  const faceline0Header = getShapeHeader(faceline0Data, s);
  console.log('🗿✉️ faceline 0 header: ', faceline0Header);

  // Parse indices for faceline 0.
  const elType = FFLiResourceShapeElementType.INDEX;
  const pos = faceline0Header.m_ElementPos[elType];
  const size = faceline0Header.m_ElementSize[elType];
  /** @type {Uint16Array} */ let indices;
  if (littleEndian) {
    indices = new Uint16Array(faceline0Data.buffer, faceline0Data.byteOffset + pos, size);
  } else {
    // endian swap
    const view = new DataView(faceline0Data.buffer, faceline0Data.byteOffset + pos, size);
    // use getUint16 with littleEndian = false
    indices = Uint16Array.from({ length: size / 2 }, (_, i) => view.getUint16(i * 2, false));
    // const indices = getShapeElement(faceline0Header, FFLiResourceShapeElementType.INDEX, faceline0Data, littleEndian);
  }
  console.log('🗿⛓️ faceline 0 indices: ', indices);
  // const positions = getShapeElement(faceline0Header, FFLiResourceShapeElementType.POSITION, faceline0Data, littleEndian);
  // console.log('🗿🧊 faceline 0 positions: ', positions);

  // Parse faceline transform for faceline 0.
  const faceline0FacelineTransform = getFacelineTransform(faceline0Data, s);
  console.log('🗿⬆️ faceline 0 transform: ', faceline0FacelineTransform);
}

// // ---------------------------------------------------------------------
// //  Zip File Reading
// // ---------------------------------------------------------------------

/**
 * Extract a single file from a zip that matches a specific suffix and fourcc.
 * @param {ArrayBuffer} buffer - The zip file data.
 * @param {string} fileSuffix - The file suffix to filter (e.g. '.dat').
 * @param {string} requiredFourCC - The required fourcc string (e.g. 'FFRA').
 * @returns {Uint8Array} The matching file data.
 * @throws {Error} If unzipping fails, zip structure is too complex, file is too small, or no file matches the fourcc.
 */
function loadSingleFileFromZipWithFourcc(buffer, fileSuffix, requiredFourCC) {
  const MAX_FILES = 5;            ///< Maximum allowed number of files in the zip.
  const MAX_RECURSION_LEVEL = 10;   ///< Maximum allowed directory recursion level.
  const MIN_FILE_SIZE = 90 * 1024;  ///< Minimum allowed file size in bytes (90 kb).

  const files = fflate.unzipSync(new Uint8Array(buffer));  ///< Unzip the data with fflate.
  const entries = Object.entries(files);  ///< Get zip entries as [name, data] pairs.
  if (entries.length > MAX_FILES) {
    throw new Error(`loadSingleFileFromZipWithFourcc: Amount of files exceeded ${MAX_FILES}.`);  ///< Fail if too many files.
  }
  let found = null;
  for (const [name, data] of entries) {
    const level = name.split('/').length - 1;  ///< Calculate directory recursion level.
    if (level > MAX_RECURSION_LEVEL) {
      throw new Error(`loadSingleFileFromZipWithFourcc: Recursion level exceeded ${MAX_RECURSION_LEVEL}.`);  ///< Fail if recursion level too deep.
    }
    if (!name.endsWith(fileSuffix)) {
      continue;  ///< Skip non-matching file suffix.
    }
    if (data.length < MIN_FILE_SIZE) {
      throw new Error(`loadSingleFileFromZipWithFourcc: File ${name} is smaller than minimum: ${MIN_FILE_SIZE}.`);  ///< Fail if file is too small.
    }
    const header = String.fromCharCode(...data.slice(0, 4));  ///< Peek first 4 bytes for fourcc.
    if (header === requiredFourCC) {
      found = data;  ///< Found a matching file.
      break;
    }
  }
  if (!found) {
    // Fail if no file matches.
    throw new Error(`No file with required fourcc (${requiredFourCC}) or suffix (${fileSuffix}) found.`);
  }
  return found;
}

// // ---------------------------------------------------------------------
// //  Utility: Load Buffer from File or URL
// // ---------------------------------------------------------------------

/**
 * Load data from a File object.
 * @param {File} file - The file from an upload.
 * @returns {Promise<ArrayBuffer>} A promise that resolves to the file's data.
 */
function bufferFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();  ///< Create a new FileReader.
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('bufferFromFile: reader.result is not an ArrayBuffer.'));
        return;
      }
      resolve(reader.result);  ///< Resolve with ArrayBuffer.
    };
    reader.onerror = (event) => {
      reject(new Error(`bufferFromFile: File reading failed: ${event.target?.error?.message}.`));  ///< Reject with error details.
    };
    reader.readAsArrayBuffer(file);  ///< Read file as ArrayBuffer.
  });
}

/**
 * Load data from a URL using fetch.
 * @param {string} url - The URL to fetch the file.
 * @returns {Promise<ArrayBuffer>} A promise that resolves to the file data.
 */
async function bufferFromUrl(url) {
  const response = await fetch(url);  ///< Fetch the zip file.
  if (!response.ok) {
    // Fail if response is bad.
    throw new Error(`bufferFromFile: Fetch failed at URL = ${response.url}, response code = ${response.status}`);
  }
  return await response.arrayBuffer();  ///< Get and return ArrayBuffer from response.
}

// // ---------------------------------------------------------------------
// //  Event Handlers for File or URL9
// // ---------------------------------------------------------------------

/**
 * Handles the file after it's uploaded or fetched.
 * Extracts the desired file if it is a zip, and then calls {@link readResourceSample}.
 * @param {ArrayBuffer} buffer - The ArrayBuffer to use.
 */
async function handleZipLoading(buffer) {
  const EXPECTED_SUFFIX_IN_ZIP = '.dat';  ///< Expected file suffix for valid files.
  const EXPECTED_FOURCC_IN_ZIP = 'FFRA';  ///< Expected fourcc header.
  const ZIP_MAGIC_PREFIX = 'PK';          ///< Prefix for zip file magic.

  try {
    // If the buffer contains zip data, get the file from it and set it as buffer.
    if (getMagicFromArrayBuffer(buffer).startsWith(ZIP_MAGIC_PREFIX)) {
      buffer = loadSingleFileFromZipWithFourcc(buffer,
        EXPECTED_SUFFIX_IN_ZIP, EXPECTED_FOURCC_IN_ZIP).buffer;  ///< Access ArrayBuffer.
    }

    readResourceSample(buffer);  ///< Call main entrypoint.
  } catch (error) {
    const e = error instanceof Error ? error.message : error;
    console.error(e);  ///< Log error message.
    alert(e);  ///< Alert error message.
  }
}

// Get input elements.
const fileInput = /** @type {HTMLInputElement} */ (document.getElementById('fileInput'));
const urlForm = /** @type {HTMLFormElement} */ (document.getElementById('urlForm'));
const urlButton = /** @type {HTMLButtonElement} */ (document.getElementById('urlButton'));
const urlInput = /** @type {HTMLInputElement} */ (document.getElementById('urlInput'));
// Above JSDoc guarantees them to be non-null, so alert if any don't exist.
const missing = ['fileInput', 'urlForm', 'urlButton', 'urlInput']
  // @ts-ignore - it is indexable by string and we just set above
  .filter(id => !globalThis[id]);  ///< NOTE: Matches either HTML ID or variable name.
if (missing.length) {
  alert(`HTML elements not found: ${missing.join(', ')}`);
}

// // ---------------------------------------------------------------------
// //  Attach Event Listeners
// // ---------------------------------------------------------------------

fileInput.addEventListener('change', async (event) => {
  const files = /** @type {HTMLInputElement} */ (event.target).files;  ///< Get the selected file.
  files && files[0] && handleZipLoading(await bufferFromFile(files[0]));  ///< Process uploaded file.
});

urlForm.addEventListener('submit', async (event) => {
  event.preventDefault();  ///< Prevent default form submission.
  const url = urlInput.value.trim();  ///< Get URL input.
  if (!url) {
    return;
  }
  urlButton.disabled = true;  ///< Disable button during fetch.
  console.log(`Fetching from: ${url}`);  ///< Log start of fetch.
  bufferFromUrl(url)
    .then((buffer) => {
      urlButton.disabled = false;  ///< Re-enable button after fetch.
      handleZipLoading(buffer);  ///< Process fetched file.
    })
    .catch ((error) => {
      const e = error instanceof Error ? error.message : error;
      console.error(e);  ///< Log error message.
      alert(e);  ///< Alert error message.
      urlButton.disabled = false;  ///< Re-enable button after failure.
    });
});
