// define shader classes ------------------------------

// ─────────────────────────────────────────────────────────────
// Helper: HermitianCurve for LUT generation
// ─────────────────────────────────────────────────────────────
class HermitianCurve {
  constructor(keys) {
    this.keys = keys.sort((a, b) => a.x - b.x);
  }
  interpolate(t, p0, p1, m0, m1) {
    const h00 = 2 * t * t * t - 3 * t * t + 1;
    const h10 = t * t * t - 2 * t * t + t;
    const h01 = -2 * t * t * t + 3 * t * t;
    const h11 = t * t * t - t * t;
    return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
  }
  generateLUT(lutSize = 512) {
    const lut = new Uint8Array(lutSize);
    let keyIdx = 0;
    for (let i = 0; i < lutSize; i++) {
      const pos = i / (lutSize - 1);
      while (keyIdx < this.keys.length - 2 && pos > this.keys[keyIdx + 1].x) {
        keyIdx++;
      }
      const p0 = this.keys[keyIdx];
      const p1 = this.keys[keyIdx + 1];
      let t = (pos - p0.x) / (p1.x - p0.x);
      t = isNaN(t) ? 0 : t;
      let y = this.interpolate(
        t,
        p0.y,
        p1.y,
        p0.dx * (p1.x - p0.x),
        p1.dx * (p1.x - p0.x)
      );
      lut[i] = Math.round(THREE.MathUtils.clamp(y, 0, 1) * 255);
    }
    return lut;
  }
}

function getBlendOptionsFromModulateType(modulateType) {
  if (modulateType >= 0 && modulateType <= 5) {
    // Opaque (DrawOpa)
    return {
      blending: THREE.CustomBlending,
      blendSrcAlpha: THREE.SrcAlphaFactor,
      blendDstAlpha: THREE.OneFactor,
    };
  } else if (modulateType >= 6 && modulateType <= 8) {
    // Translucent (DrawXlu)
    return {
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendDstAlpha: THREE.OneFactor,
    };
  } else if (modulateType >= 9 && modulateType <= 13) {
    // Mask Textures
    return {
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneMinusDstAlphaFactor,
      blendDst: THREE.DstAlphaFactor,
    };
  } else if (modulateType >= 14 && modulateType <= 17) {
    // Faceline Texture
    return {
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    };
  } else {
    console.error(`Unknown modulate type: ${modulateType}.`);
    return {};
  }
}


// ─────────────────────────────────────────────────────────────
// FFLShaderMaterial Class
// ─────────────────────────────────────────────────────────────
class FFLShaderMaterial extends THREE.ShaderMaterial {
  // Default light and rim constants:
  static defaultLightAmbient = new THREE.Vector4(0.73, 0.73, 0.73, 1.0);
  static defaultLightDiffuse = new THREE.Vector4(0.6, 0.6, 0.6, 1.0);
  static defaultLightSpecular = new THREE.Vector4(0.7, 0.7, 0.7, 1.0);
  static defaultLightDir = new THREE.Vector3(-0.4531539381, 0.4226179123, 0.7848858833);
  static defaultRimColor = new THREE.Vector4(0.3, 0.3, 0.3, 1.0);
  static defaultRimPower = 2.0;

  static defaultLightDirection = this.defaultLightDir;

  // Material table for FFLDefaultShader mapping to FFLModulateType
  // Reference: https://github.com/aboood40091/FFL-Testing/blob/master/src/Shader.cpp
  static materialParams = [
    {
      // FFL_MODULATE_TYPE_SHAPE_FACELINE
      ambient: new THREE.Vector4(0.85, 0.75, 0.75, 1.0),
      diffuse: new THREE.Vector4(0.75, 0.75, 0.75, 1.0),
      specular: new THREE.Vector4(0.3, 0.3, 0.3, 1.0),
      specularPower: 1.2,
      specularMode: 0,
    },
    {
      // FFL_MODULATE_TYPE_SHAPE_BEARD
      ambient: new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
      diffuse: new THREE.Vector4(0.7, 0.7, 0.7, 1.0),
      specular: new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
      specularPower: 40.0,
      specularMode: 1,
    },
    {
      // FFL_MODULATE_TYPE_SHAPE_NOSE
      ambient: new THREE.Vector4(0.9, 0.85, 0.85, 1.0),
      diffuse: new THREE.Vector4(0.75, 0.75, 0.75, 1.0),
      specular: new THREE.Vector4(0.22, 0.22, 0.22, 1.0),
      specularPower: 1.5,
      specularMode: 0,
    },
    {
      // FFL_MODULATE_TYPE_SHAPE_FOREHEAD
      ambient: new THREE.Vector4(0.85, 0.75, 0.75, 1.0),
      diffuse: new THREE.Vector4(0.75, 0.75, 0.75, 1.0),
      specular: new THREE.Vector4(0.3, 0.3, 0.3, 1.0),
      specularPower: 1.2,
      specularMode: 0,
    },
    {
      // FFL_MODULATE_TYPE_SHAPE_HAIR
      ambient: new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
      diffuse: new THREE.Vector4(0.7, 0.7, 0.7, 1.0),
      specular: new THREE.Vector4(0.35, 0.35, 0.35, 1.0),
      specularPower: 10.0,
      specularMode: 1,
    },
    {
      // FFL_MODULATE_TYPE_SHAPE_CAP
      ambient: new THREE.Vector4(0.75, 0.75, 0.75, 1.0),
      diffuse: new THREE.Vector4(0.72, 0.72, 0.72, 1.0),
      specular: new THREE.Vector4(0.3, 0.3, 0.3, 1.0),
      specularPower: 1.5,
      specularMode: 0,
    },
    {
      // FFL_MODULATE_TYPE_SHAPE_MASK
      ambient: new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
      diffuse: new THREE.Vector4(0.7, 0.7, 0.7, 1.0),
      specular: new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
      specularPower: 40.0,
      specularMode: 1,
    },
    {
      // FFL_MODULATE_TYPE_SHAPE_NOSELINE
      ambient: new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
      diffuse: new THREE.Vector4(0.7, 0.7, 0.7, 1.0),
      specular: new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
      specularPower: 40.0,
      specularMode: 1,
    },
    {
      // FFL_MODULATE_TYPE_SHAPE_GLASS
      ambient: new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
      diffuse: new THREE.Vector4(0.7, 0.7, 0.7, 1.0),
      specular: new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
      specularPower: 40.0,
      specularMode: 1,
    },
    
    {
      // body
      ambient: new THREE.Vector4(0.95622, 0.95622, 0.95622, 1.0),
      diffuse: new THREE.Vector4(0.49673, 0.49673, 0.49673, 1.0),
      specular: new THREE.Vector4(0.24099, 0.24099, 0.24099, 1.0),
      specularPower: 3.0,
      specularMode: 0,
    },
    {
      // pants
      ambient: new THREE.Vector4(0.95622, 0.95622, 0.95622, 1.0),
      diffuse: new THREE.Vector4(1.08497, 1.08497, 1.08497, 1.0),
      specular: new THREE.Vector4(0.2409, 0.2409, 0.2409, 1.0),
      specularPower: 3.0,
      specularMode: 0,
    },
  ];


  /**
   * Options (all are optional):
   *   - modulateMode: number (default 0)
   *   - modulateType: number (default 0; selects a row from materialParams)
   *   - modulateColor: either a THREE.Vector4 OR an array of THREE.Vector4 of length 3.
   *         If an array is provided, they map to u_const1, u_const2, u_const3.
   *   - lightEnable: boolean (default true)
   *   - lightDirection: THREE.Vector3 (default as defined)
   *   - map: (optional) THREE.Texture
   *   - vertexShader/fragmentShader: shader sources (defaults come from HTML IDs below)
   *   - side, transparent, alphaTest: additional material flags
   */
  constructor(options = {}) {
    const modulateMode = options.modulateMode ?? 0;
    const modulateType = options.modulateType ?? 0;
    const lightEnable = options.lightEnable ?? true;
    const lightDir = options.lightDirection ?? FFLShaderMaterial.defaultLightDir.clone();
    const texture = options.map || null; // may be null

    // Process modulateColor input:
    let colorUniforms = {};
    if (Array.isArray(options.modulateColor) && options.modulateColor.length === 3) {
      colorUniforms = {
        u_const1: { value: options.modulateColor[0] },
        u_const2: { value: options.modulateColor[1] },
        u_const3: { value: options.modulateColor[2] }
      };
    } else {
      colorUniforms = {
        u_const1: { value: options.modulateColor || new THREE.Vector4(1, 1, 1, 1) }
      };
    }
    
    const matParam =
      FFLShaderMaterial.materialParams[modulateType] ||
      FFLShaderMaterial.materialParams[0];

    const uniforms = Object.assign({}, colorUniforms, {
      u_light_ambient: {
        value: options.lightAmbient || FFLShaderMaterial.defaultLightAmbient,
      },
      u_light_diffuse: {
        value: options.lightDiffuse || FFLShaderMaterial.defaultLightDiffuse,
      },
      u_light_specular: {
        value: options.lightSpecular || FFLShaderMaterial.defaultLightSpecular,
      },
      u_light_dir: { value: lightDir },
      u_light_enable: { value: lightEnable },
      u_material_ambient: { value: matParam.ambient },
      u_material_diffuse: { value: matParam.diffuse },
      u_material_specular: { value: matParam.specular },
      u_material_specular_mode: { value: matParam.specularMode },
      u_material_specular_power: { value: matParam.specularPower },
      u_mode: { value: modulateMode },
      u_rim_color: { value: FFLShaderMaterial.defaultRimColor },
      u_rim_power: { value: FFLShaderMaterial.defaultRimPower },
      s_texture: { value: texture }
    });

    super({
      vertexShader:
        options.vertexShader ||
        document.getElementById("FFLShaderVert").textContent,
      fragmentShader:
        options.fragmentShader ||
        document.getElementById("FFLShaderFrag").textContent,
      uniforms: uniforms,
      side: options.side || THREE.FrontSide,
      ...getBlendOptionsFromModulateType(modulateType) // Merge blend options
    });
    this.map = texture; // so it can be read like other materials
  }
}

// ─────────────────────────────────────────────────────────────
// LUTShaderMaterial Class
// ─────────────────────────────────────────────────────────────
class LUTShaderMaterial extends THREE.ShaderMaterial {
  // Enumerations for LUT types:
  static LUTSpecularTextureType = {
    NONE: 0,
    DEFAULT_02: 1,
    SKIN_01: 2,
    MAX: 3,
  };
  static LUTFresnelTextureType = {
    NONE: 0,
    DEFAULT_02: 1,
    SKIN_01: 2,
    MAX: 3,
  };

  // LUT curve definitions:
  static lutDefinitions = {
    specular: {
      [LUTShaderMaterial.LUTSpecularTextureType.NONE]: new HermitianCurve([
        { x: 0, y: 0, dx: 0, dy: 0 },
        { x: 1, y: 0, dx: 0, dy: 0 },
      ]),
      [LUTShaderMaterial.LUTSpecularTextureType.DEFAULT_02]: new HermitianCurve([
        { x: 0, y: 0, dx: 0, dy: 0 },
        { x: 0.05, y: 0, dx: 0, dy: 0 },
        {
          x: 0.8,
          y: 0.038,
          dx: 0.157894736842105,
          dy: 0.157894736842105,
        },
        { x: 1, y: 0.11, dx: 0, dy: 0 },
      ]),
      [LUTShaderMaterial.LUTSpecularTextureType.SKIN_01]: new HermitianCurve([
        {
          x: 0,
          y: 0.03,
          dx: -0.105263157894737,
          dy: -0.105263157894737,
        },
        { x: 1, y: 0, dx: 0, dy: 0 },
      ]),
    },
    fresnel: {
      [LUTShaderMaterial.LUTFresnelTextureType.NONE]: new HermitianCurve([
        { x: 0, y: 0, dx: 0, dy: 0 },
        { x: 1, y: 0, dx: 0, dy: 0 },
      ]),
      [LUTShaderMaterial.LUTFresnelTextureType.DEFAULT_02]: new HermitianCurve([
        {
          x: 0,
          y: 0.3,
          dx: -0.105263157894734,
          dy: -0.105263157894734,
        },
        {
          x: 0.175,
          y: 0.23,
          dx: -0.626315789473681,
          dy: -0.626315789473681,
        },
        {
          x: 0.6,
          y: 0.05,
          dx: -0.210526315789474,
          dy: -0.210526315789474,
        },
        {
          x: 1,
          y: 0,
          dx: -0.105263157894737,
          dy: -0.105263157894737,
        },
      ]),
      [LUTShaderMaterial.LUTFresnelTextureType.SKIN_01]: new HermitianCurve([
        {
          x: 0.005,
          y: 0.35,
          dx: -0.105263157894734,
          dy: -0.105263157894734,
        },
        {
          x: 0.173,
          y: 0.319,
          dx: -0.205263157894734,
          dy: -0.205263157894734,
        },
        {
          x: 0.552,
          y: 0.051,
          dx: -0.210526315789474,
          dy: -0.210526315789474,
        },
        { x: 1, y: 0.001, dx: 0, dy: 0 },
      ]),
    },
  };

  // LUT lookup tables (indexed by modulate type)
  static modulateToLUTSpecular = [
    LUTShaderMaterial.LUTSpecularTextureType.SKIN_01, // 0: FACELINE
    LUTShaderMaterial.LUTSpecularTextureType.DEFAULT_02, // 1: BEARD
    LUTShaderMaterial.LUTSpecularTextureType.SKIN_01, // 2: NOSE
    LUTShaderMaterial.LUTSpecularTextureType.SKIN_01, // 3: FOREHEAD
    LUTShaderMaterial.LUTSpecularTextureType.DEFAULT_02, // 4: HAIR
    LUTShaderMaterial.LUTSpecularTextureType.DEFAULT_02, // 5: CAP
    LUTShaderMaterial.LUTSpecularTextureType.DEFAULT_02, // 6: MASK
    LUTShaderMaterial.LUTSpecularTextureType.NONE, // 7: NOSELINE
    LUTShaderMaterial.LUTSpecularTextureType.NONE, // 8: GLASS
    LUTShaderMaterial.LUTSpecularTextureType.DEFAULT_02, // 9: CUSTOM (BODY)
    LUTShaderMaterial.LUTSpecularTextureType.DEFAULT_02, // 10: CUSTOM (PANTS)
  ];
  static modulateToLUTFresnel = [
    LUTShaderMaterial.LUTFresnelTextureType.SKIN_01, // 0: FACELINE
    LUTShaderMaterial.LUTFresnelTextureType.DEFAULT_02, // 1: BEARD
    LUTShaderMaterial.LUTFresnelTextureType.SKIN_01, // 2: NOSE
    LUTShaderMaterial.LUTFresnelTextureType.SKIN_01, // 3: FOREHEAD
    LUTShaderMaterial.LUTFresnelTextureType.DEFAULT_02, // 4: HAIR
    LUTShaderMaterial.LUTFresnelTextureType.DEFAULT_02, // 5: CAP
    LUTShaderMaterial.LUTFresnelTextureType.DEFAULT_02, // 6: MASK
    LUTShaderMaterial.LUTFresnelTextureType.NONE, // 7: NOSELINE
    LUTShaderMaterial.LUTFresnelTextureType.NONE, // 8: GLASS
    LUTShaderMaterial.LUTFresnelTextureType.DEFAULT_02, // 9: CUSTOM (BODY)
    LUTShaderMaterial.LUTFresnelTextureType.DEFAULT_02, // 10: CUSTOM (PANTS)
  ];

  // Cache LUT textures so we generate them only once.
  static _lutTextures = null;
  static getLUTTextures(lutSize = 512) {
    if (!LUTShaderMaterial._lutTextures) {
      const textures = { specular: {}, fresnel: {} };
      // Create specular LUT textures:
      for (const [key, curve] of Object.entries(
        LUTShaderMaterial.lutDefinitions.specular
      )) {
        const lutData = curve.generateLUT(lutSize);
        const texture = new THREE.DataTexture(
          lutData,
          lutSize,
          1,
          THREE.RedFormat,
          THREE.UnsignedByteType
        );
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        textures.specular[key] = texture;
      }
      // Create fresnel LUT textures:
      for (const [key, curve] of Object.entries(
        LUTShaderMaterial.lutDefinitions.fresnel
      )) {
        const lutData = curve.generateLUT(lutSize);
        const texture = new THREE.DataTexture(
          lutData,
          lutSize,
          1,
          THREE.RedFormat,
          THREE.UnsignedByteType
        );
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        textures.fresnel[key] = texture;
      }
      LUTShaderMaterial._lutTextures = textures;
    }
    return LUTShaderMaterial._lutTextures;
  }

  // Default light colors for the LUT shader:
  static defaultHSLightGroundColor = new THREE.Vector3(0.87843, 0.72157, 0.5898);
  static defaultHSLightSkyColor = new THREE.Vector3(0.87843, 0.83451, 0.80314);
  static defaultDirLightColor0 = new THREE.Vector3(0.35137, 0.32392, 0.32392);
  static defaultDirLightColor1 = new THREE.Vector3(0.10039, 0.09255, 0.09255);
  static defaultDirLightCount = 2;
  static defaultDirLightDirAndType0 = new THREE.Vector4(-0.2, 0.5, 0.8, -1.0);
  static defaultDirLightDirAndType1 = new THREE.Vector4(0.0, -0.19612, 0.98058, -1.0);

  static defaultLightDirection = this.defaultDirLightDirAndType0;

  /**
   * Options (all optional):
   *   - modulateMode: number (default 0)
   *   - modulateType: number (default 0; used to pick LUTs via lookup tables)
   *   - modulateColor: either a THREE.Vector4 OR an array of 3 THREE.Vector4
   *         (maps to uColor0, uColor1, uColor2)
   *   - lightEnable: boolean (default true)
   *   - dirLightDirAndType0, dirLightDirAndType1: THREE.Vector3 (default as defined)
   *   - map: (optional) albedo map
   *   - Additional light colors (hslight, directional, etc.) can be provided.
   */
  constructor(options = {}) {
    const modulateMode = options.modulateMode ?? 0;
    const modulateType = options.modulateType ?? 0;
    const lightEnable = options.lightEnable ?? true;
    const texture = options.map || null;
    // Enable alpha test for DrawXlu stage.
    const alphaTest = (modulateType >= 6 && modulateType <= 8)
                ? true : options.alphaTest;
    // Force culling to none for mask.
    //const side = modulateType === 6 ? THREE.DoubleSide : options.side;

    // Process modulateColor:
    let colorUniforms = {};
    if (Array.isArray(options.modulateColor) && options.modulateColor.length === 3) {
      colorUniforms = {
        uColor0: { value: options.modulateColor[0] },
        uColor1: { value: options.modulateColor[1] },
        uColor2: { value: options.modulateColor[2] }
      };
    } else {
      colorUniforms = {
        uColor0: { value: options.modulateColor || new THREE.Vector4(1, 1, 1, 1) }
      };
    }
    
    const lutTextures = LUTShaderMaterial.getLUTTextures();
    const specType =
      LUTShaderMaterial.modulateToLUTSpecular[modulateType] ??
      LUTShaderMaterial.LUTSpecularTextureType.NONE;
    const fresType =
      LUTShaderMaterial.modulateToLUTFresnel[modulateType] ??
      LUTShaderMaterial.LUTFresnelTextureType.NONE;
    const lutSpecTexture = lutTextures.specular[specType];
    const lutFresTexture = lutTextures.fresnel[fresType];

    const uniforms = Object.assign({}, colorUniforms, {
      uBoneCount: { value: 0 },
      uAlpha: { value: 1.0 },
      uHSLightGroundColor: {
        value:
          options.hslightGroundColor ||
          LUTShaderMaterial.defaultHSLightGroundColor,
      },
      uHSLightSkyColor: {
        value: options.hslightSkyColor || LUTShaderMaterial.defaultHSLightSkyColor,
      },
      uDirLightColor0: {
        value: options.dirLightColor0 || LUTShaderMaterial.defaultDirLightColor0,
      },
      uDirLightColor1: {
        value: options.dirLightColor1 || LUTShaderMaterial.defaultDirLightColor1,
      },
      uDirLightCount: {
        value: options.dirLightCount || LUTShaderMaterial.defaultDirLightCount,
      },
      uDirLightDirAndType0: {
        value:
          options.dirLightDirAndType0 ||
          LUTShaderMaterial.defaultDirLightDirAndType0.clone(),
      },
      uDirLightDirAndType1: {
        value:
          options.dirLightDirAndType1 ||
          LUTShaderMaterial.defaultDirLightDirAndType1.clone(),
      },
      uLightEnable: { value: lightEnable },
      uLightColor: {
        value: options.lightColor || new THREE.Vector3(0.35137, 0.32392, 0.32392),
      },
      uMode: { value: modulateMode },
      // NOTE about uAlphaTest:
      // Only real purpose it serves is to discard/
      // skip writing depth for DrawXlu elements.
      // Usually (not in Miitomo) all DrawXlu elements have depth writing disabled
      // but in this case Miitomo has it enabled but discards depth writes here
      uAlphaTest: { value: alphaTest },
      uAlbedoTexture: { value: texture },
      uLUTSpecTexture: { value: lutSpecTexture },
      uLUTFresTexture: { value: lutFresTexture }
    });

    super({
      vertexShader:
        options.vertexShader ||
        document.getElementById("LUTShaderVert").textContent,
      fragmentShader:
        options.fragmentShader ||
        document.getElementById("LUTShaderFrag").textContent,
      uniforms: uniforms,
      side: options.side || THREE.FrontSide,
      //side: side || THREE.FrontSide,

      ...getBlendOptionsFromModulateType(modulateType) // Merge blend options
    });
    this.map = texture; // so it can be read like other materials
  }
}


// ----------------------------------------------------
const shaders = { FFLShaderMaterial, LUTShaderMaterial };

// ─────────────────────────────────────────────────────────────
// Active Shader Class Handling
// ─────────────────────────────────────────────────────────────
let activeShaderClassName = 'FFLShaderMaterial'; // Default shader

function applyShaderMaterial(mesh, userData, originalMaterial) {
  const ShaderClass = shaders[activeShaderClassName];
  if (!ShaderClass) {
    console.error(`Shader class ${activeShaderClassName} not found.`);
    return;
  }

  const modulateColor = userData.modulateColor
    ? new THREE.Vector4(...userData.modulateColor, 1)
    : new THREE.Vector4(1, 0, 0, 1); // Default red if missing

  // mask should use THREE.DoubleSide only with LUT shader (HACK!)
  const side = userData.modulateType === 6 ? (activeShaderClassName === 'LUTShaderMaterial'
          ? THREE.DoubleSide : THREE.FrontSide) : originalMaterial.side
  
  // Create the shader material
  const shaderMaterial = new ShaderClass({
    modulateMode: userData.modulateMode,
    modulateType: userData.modulateType,
    modulateColor: modulateColor,
    side: side,
    map: originalMaterial.map,
  });

  // Apply the material to the mesh
  mesh.material = shaderMaterial;
}

// Apply shader to the whole model
function applyShaderMaterialToModel(model) {
  if (model) {
    model.traverse((node) => {
      if (node.isMesh && node.geometry && node.material) {
        const userData = node.geometry.userData;
        applyShaderMaterial(node, userData, node.material);
      }
    });
  }
}

// Handle shader selection change from HTML dropdown
document.getElementById('shaderSelector').addEventListener('change', function () {
  activeShaderClassName = this.value;

  // Update light direction inputs based on the selected shader's defaults
  if (activeShaderClassName === 'FFLShaderMaterial') {
    const dir = FFLShaderMaterial.defaultLightDir;
    document.getElementById('lightDirX').value = dir.x;
    document.getElementById('lightDirY').value = dir.y;
    document.getElementById('lightDirZ').value = dir.z;
  } else if (activeShaderClassName === 'LUTShaderMaterial') {
    const dir = LUTShaderMaterial.defaultDirLightDirAndType0;
    document.getElementById('lightDirX').value = dir.x;
    document.getElementById('lightDirY').value = dir.y;
    document.getElementById('lightDirZ').value = dir.z;
  }

  applyShaderMaterialToModel(window.model); // Apply the selected shader to the model
  updateLightDirection(); // Apply the new light direction immediately
});


// Begin Scene ----------------------------------------

// Set up the scene, camera, and renderer
const scene = new THREE.Scene();

// Set a pastel purple background color
// already set by html background
scene.background = new THREE.Color(0xE6E6FA); // Light lavender

// Perspective camera with specified parameters
const fov = 15; // Field of view in degrees
const aspect = window.innerWidth / window.innerHeight; // Aspect ratio
const near = 10; // Near clipping plane
const far = 10000; // Far clipping plane
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

// Position the camera and set the lookAt point
camera.position.set(0, 37.05, 415.53); // Camera position
camera.lookAt(new THREE.Vector3(0, 37.05, 0)); // LookAt point

// Initialize the WebGL renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add OrbitControls to allow mouse interaction
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 37.05, 0);
controls.update();

// Variables to control rotation
let isRotating = true
let rotationSpeed = parseFloat(document.getElementById("rotationSpeed").value);

// Variable to hold the loaded model
window.model = null;

// Select the Load Model button to later disable/re-enable it
const loadModelButton = document.getElementById("loadModelButton")

// ─────────────────────────────────────────────────────────────
// Model Loading
// ─────────────────────────────────────────────────────────────
const loadModel = (url) => {
  // Disable the Load Model button when loading starts
  if (loadModelButton) loadModelButton.disabled = true

  // Remove existing model if any
  if (model) {
    scene.remove(model)
    model.traverse((child) => {
      if (child.isMesh) {
        //child.geometry.dispose()
        //if (child.material.map) child.material.map.dispose()
        //child.material.dispose()
      }
    })
    model = null
  }

  // Instantiate the GLTFLoader
  const loader = new THREE.GLTFLoader()

  // Load the glTF model
  loader.load(
    url,
    (gltf) => {
      // Extract the loaded scene/model
      window.model = gltf.scene

      /*
      // Traverse the model to access its meshes
      model.traverse((node) => {
        if (!node.isMesh) {
          return;
        }
        
        const ShaderClass = shaders[activeShaderClassName];
        if (!ShaderClass) {
          alert(`Shader class ${activeShaderClassName} not found.`);
          return;
        }
        const originalMaterial = node.material;

        // Access userData from geometry
        const userData = node.geometry.userData;

        // Retrieve modulateType and map to material parameters
        if (userData.modulateType === undefined)
          console.warn(
            `Mesh "${node.name}" is missing "modulateType" in userData.`,
          )
        //else
        //  node.renderOrder = userData.modulateType;

        node.material = new ShaderClass({
          modulateMode: userData.modulateMode ?? 0,
          modulateType: userData.modulateType,
          modulateColor: userData.modulateColor,
          side: originalMaterial.side,
          map: originalMaterial.map
        });
        // depth write for mask/glass should be disabled only
        // with ffl shader but haven't seen problems there yet
      })
      */
      
      applyShaderMaterialToModel(window.model); // Apply shader to new model
      updateLightDirection();       // Apply light direction to new model

      // Add the model to the scene
      scene.add(window.model);

      // Re-enable the Load Model button after loading completes
      loadModelButton.disabled = false
    },
    undefined,
    (error) => {
      console.error("An error occurred while loading the model:", error)
      alert("An error occurred while loading the model: " + error.toString())
      // Re-enable the Load Model button if there's an error
      loadModelButton.disabled = false
    },
  )
}

// Animation loop
const animate = () => {
  requestAnimationFrame(animate)

  // Rotate the model around the Y-axis if rotation is enabled
  if (model && isRotating) {
    model.rotation.y += rotationSpeed
  }

  // Render the scene from the camera's perspective
  renderer.render(scene, camera)
}

// Handle window resize events
window.addEventListener(
  "resize",
  () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  },
  false,
)

// Handle form submission to load a new model
document.getElementById("modelForm").addEventListener("submit", (event) => {
  event.preventDefault() // Prevent the default form submission behavior
  const url = document.getElementById("modelUrl").value.trim()
  if (url)
    loadModel(url) // Load the model from the specified URL
  else alert("Please enter a URL to a valid model in glTF format.")
})

let isPausedByButton = false // Tracks if rotation is paused via the pause button
let isPausedByMouse = false // Tracks if rotation is paused via mouse interaction

// Handle pause and resume buttons visibility and rotation state
document.getElementById("pauseButton").addEventListener("click", function () {
  isPausedByButton = true
  isRotating = false
  pauseButton.style.display = "none"
  resumeButton.style.display = "block"
})

document.getElementById("resumeButton").addEventListener("click", function () {
  isPausedByButton = false
  isRotating = true
  pauseButton.style.display = "block"
  resumeButton.style.display = "none"
})

// Add event listeners to the renderer's DOM element for mouse interactions
renderer.domElement.addEventListener("pointerdown", () => {
  if (!isPausedByButton && isRotating) {
    isRotating = false
    isPausedByMouse = true
  }
})

// Handle mouse up event to restart rotation if it wasn't paused by the button
renderer.domElement.addEventListener("pointerup", () => {
  if (isPausedByMouse && !isPausedByButton) {
    isRotating = true
    isPausedByMouse = false
  }
})

// Handle rotation speed slider
document.getElementById("rotationSpeed").addEventListener("input", function () {
  rotationSpeed = parseFloat(this.value) || 0
})

// Toggle UI functionality
const hideUiButton = document.getElementById("hideUiButton")
const showUiButton = document.getElementById("showUiButton")
const ui = document.getElementById("ui")

hideUiButton.addEventListener("click", () => {
  ui.style.display = "none"
  showUiButton.style.display = ""
})
showUiButton.addEventListener("click", () => {
  ui.style.display = ""
  showUiButton.style.display = "none"
})



// ─────────────────────────────────────────────────────────────
// Light Direction Handling
// ─────────────────────────────────────────────────────────────
const updateLightDirection = () => {
  const x = parseFloat(document.getElementById('lightDirX').value);
  const y = parseFloat(document.getElementById('lightDirY').value);
  const z = parseFloat(document.getElementById('lightDirZ').value);
  const newDir = new THREE.Vector3(x, y, z);

  if (model) {
    model.traverse((node) => {
      if (node.isMesh && node.material && node.material.uniforms) {
        if (activeShaderClassName === 'FFLShaderMaterial') {
          node.material.uniforms.u_light_dir.value.copy(newDir);
        } else if (activeShaderClassName === 'LUTShaderMaterial') {
          node.material.uniforms.uDirLightDirAndType0.value.set(newDir.x, newDir.y, newDir.z, -1.0);
        }
      }
    });
  }
}

// Attach event listeners to light direction sliders
['lightDirX', 'lightDirY', 'lightDirZ'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateLightDirection);
});

// ─────────────────────────────────────────────────────────────
// Reset Light Direction
// ─────────────────────────────────────────────────────────────
function resetLightDirection() {
  const ShaderClass = shaders[activeShaderClassName];
  if (!ShaderClass) {
    console.error(`Shader class ${activeShaderClassName} not found.`);
    return;
  }

  const defaultDir = ShaderClass.defaultLightDirection;
  document.getElementById('lightDirX').value = defaultDir.x;
  document.getElementById('lightDirY').value = defaultDir.y;
  document.getElementById('lightDirZ').value = defaultDir.z;

  updateLightDirection(); // Apply the reset values to the shader
}

// Add event listener to the reset button
document
  .getElementById("resetLightButton")
  .addEventListener("click", resetLightDirection)

// Load the default model on startup
loadModel(document.getElementById("modelUrl").value)

// Start the animation loop
animate()
