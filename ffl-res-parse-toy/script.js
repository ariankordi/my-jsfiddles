// @ts-check
//import * as _ from './struct-fu.js';
/* eslint @stylistic/indent: ['error', 2] -- Define indent rules. */
/* eslint @stylistic/spaced-comment: ['error', 'always', {
    line: { markers: ['/<', '!<'] },
    block: { markers: ['*'], balanced: true }
  }],
  @stylistic/no-multi-spaces: 'off'
  -- Allow Doxygen-style inline brief comments.
*/

// CHANGE THESE -------------------------------------------

const resourceFetchPath = 'https://debian.local:8445/assets/web%20builds/AFLResHigh_2_3_LE_half_float.dat'; //!< Change this to something you can fetch() from.
const useAFL_2_3TextureHeader = true; //!< Set to false for FFL Wii U resources.

// --------------------------------------------------------

// Constants for resource header magic.
const FFLiResourceHeader_MagicBE = 'FFRA';
const FFLiResourceHeader_MagicLE = 'ARFF';
const FFLiResourceHeader_MagicU32 = 0x46465241;
// This sample tries? to detect endianness from the magic.

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
 * @typedef {Object} FFLiResourceTextureFooter
 * @property {number} m_MipOffset
 * @property {number} m_Width
 * @property {number} m_Height
 * @property {number} m_NumMips
 * @property {number} m_TextureFormat - enum FFLiTextureFormat
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

  /** @type {_.StructInstance<FFLiResourcePartsInfo>} */
  const FFLiResourcePartsInfo = _.struct([
    uint32bi('dataPos'),
    uint32bi('dataSize'),
    uint32bi('compressedSize'),
    _.uint8('compressLevel'),
    _.uint8('windowBits'),
    _.uint8('memoryLevel'),
    _.uint8('strategy')
  ]);

  /** @type {_.StructInstance<FFLiResourceTextureHeader>} */
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

  /** @type {_.StructInstance<FFLiResourceTextureFooter>} */
  const FFLiResourceTextureFooter = _.struct([
    uint32bi('m_MipOffset'),
    uint16bi('m_Width'),
    uint16bi('m_Height'),
    _.uint8('m_NumMips'),
    _.uint8('m_TextureFormat'),
    _.byte('_padding', 2) // Includes two bytes of padding.
  ]);

  /** @type {_.StructInstance<FFLiResourceShapeHeader>} */
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

  /** @type {_.StructInstance<FFLVec3>} */
  const FFLVec3 = _.struct([
    float32bi('x'),
    float32bi('y'),
    float32bi('z')
  ]);

  /** @type {_.StructInstance<FFLiResourceShapeFacelineTransform>} */
  const FFLiResourceShapeFacelineTransform = _.struct([
    _.struct('m_HairTranslate', [FFLVec3]),
    _.struct('m_NoseTranslate', [FFLVec3]),
    _.struct('m_BeardTranslate', [FFLVec3])
  ]);
  /** @type {_.StructInstance<FFLiResourceShapeHairTransform>} */
  const FFLiResourceShapeHairTransform = _.struct([
    _.struct('m_FrontTranslate', [FFLVec3]),
    _.struct('m_FrontRotate', [FFLVec3]),
    _.struct('m_SideTranslate', [FFLVec3]),
    _.struct('m_SideRotate', [FFLVec3]),
    _.struct('m_TopTranslate', [FFLVec3]),
    _.struct('m_TopRotate', [FFLVec3])
  ]);

  /** @type {_.StructInstance<FFLBoundingBox>} */
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
  /** @type {_.StructInstance<FFLiResourceHeader>} */
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
 * Parse big-endian uint32 to four characters.
 * @param {number} i - Big-endian unsigned 32-bit integer.
 * @returns {string} Four characters.
 */
const charFromU32 = i =>
  String.fromCharCode(
    (i >> 24) & 0xFF, ///< Highest byte (MSB).
    (i >> 16) & 0xFF, ///< Second highest byte.
    (i >> 8) & 0xFF,  ///< Second lowest byte.
    i & 0xFF          ///< Lowest byte (LSB).
  );

// // ---------------------------------------------------------------------
// //  Primary Entrypoint
// // ---------------------------------------------------------------------

(async () => {
  // Download resource.
  const response = await fetch(resourceFetchPath);
  if (!response.ok) {
    throw new Error('fetch response not ok');
  }
  const resArrayBuffer = await response.arrayBuffer();
  console.log('📁 resArrayBuffer:', resArrayBuffer);

  // Peek at the magic for validity and determine endianness.
  // Read at offset 0 and littleEndian = false.
  const magicU32 = new DataView(resArrayBuffer).getUint32(0, false);
  const magic = charFromU32(magicU32);
  console.log(`🫣 peeked at magic (0x${magicU32.toString(16)}) = "${magic}"`);

  // Set endianness based on the value of magic.
  let littleEndian;
  if (magic === FFLiResourceHeader_MagicBE) {
    littleEndian = false;
    console.log('🔧 parsing in big-endian...');
  } else if (magic === FFLiResourceHeader_MagicLE) {
    littleEndian = true;
    console.log('🦴 parsing in little-endian...');
  } else {
    throw new Error('unknown magic, not parsing');
  }

  // Construct structs with specified endianness.
  const s = createFFLiResourceStructs(littleEndian, useAFL_2_3TextureHeader);

  // Parse FFLiResourceHeader to object.
  const resource = s.FFLiResourceHeader.unpack(resArrayBuffer);
  console.log('✅ FFLiResourceHeader.unpack result:', resource);
  if (resource.m_Magic !== FFLiResourceHeader_MagicU32) {
    // print real and expected magic both in hex (base 16)
    console.error(`❌ failed to parse magic, got: 0x${resource.m_Magic.toString(16)}, expected: 0x${FFLiResourceHeader_MagicU32.toString(16)}`);
  }

  // Extract m_ExpandBufferSize/total uncompressed resource size.
  const expandBufferSizeWithoutResHint = resource.m_ExpandBufferSize & 0x1FFFFFFF; // only last 29 bits, see FFLiResourceUtil.cpp
  const totalUncompressedResSizeMB = Math.trunc(expandBufferSizeWithoutResHint / (1024 * 1024));

  if (totalUncompressedResSizeMB > 75) {
    // Assert if the resource is suspiciously large, assuming the number was read wrong.
    console.error(`🤨 you sure this resource is ${totalUncompressedResSizeMB} MB large?`);
  }

  console.log(`ℹ️ resource total uncompressed size: ${totalUncompressedResSizeMB} MB`);
  console.log('🖼️ m_TextureHeader:', resource.m_TextureHeader);
  console.log('📐 m_ShapeHeader:', resource.m_ShapeHeader);
})();
