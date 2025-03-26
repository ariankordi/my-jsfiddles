// @ts-check
// import * as THREE from 'three';
// import * as FFLShaderMaterial from './FFLShaderMaterial.js';
// import * as LUTShaderMaterial from './LUTShaderMaterial.js';

/* eslint @stylistic/indent: ['error', 2] -- Define indent rules. */

/* NOTglobals FFLShaderMaterial LUTShaderMaterial -- Global dependencies. */

/** @type {Object<string, function(new: THREE.Material, ...*): THREE.Material>} */
const shaders = { FFLShaderMaterial, LUTShaderMaterial };

// // ---------------------------------------------------------------------
// //  Active Shader Class Handling
// // ---------------------------------------------------------------------
/** The name of the active shader class, initialized to the first. */
let activeShaderClassName = Object.keys(shaders)[0];

/**
 * Applies the current shader material to the mesh.
 * @param {THREE.Mesh} mesh - The mesh to apply the shader material to.
 * @param {{modulateType: number, modulateMode: number, modulateColor: Array<number>}} userData -
 * The userData from the glTF.
 * @param {THREE.MeshBasicMaterial & {_side: THREE.Side|undefined}} originalMaterial -
 * The original material of the mesh.
 */
function applyShaderMaterial(mesh, userData, originalMaterial) {
  const ShaderClass = shaders[activeShaderClassName];
  if (!ShaderClass) {
    console.error(`Shader class ${activeShaderClassName} not found.`);
    return;
  }

  /** Color bound to the material. Defaults to red if missing. */
  const modulateColor = Array.isArray(userData.modulateColor)
    ? new THREE.Color(userData.modulateColor[0],
      userData.modulateColor[1], userData.modulateColor[2])
    : new THREE.Color(1, 0, 0);

  // Create the shader material
  const shaderMaterial = new ShaderClass({
    // _side = original side from LUTShaderMaterial, must be set first
    side: (originalMaterial._side !== undefined) ? originalMaterial._side : originalMaterial.side,
    modulateMode: userData.modulateMode,
    modulateType: userData.modulateType, // this setter sets side too
    color: modulateColor, // should be after modulateType
    map: originalMaterial.map,
    // For "MASK", only alphaTest is set.
    transparent: originalMaterial.transparent || originalMaterial.alphaTest
  });

  // Apply the material to the mesh
  mesh.material = shaderMaterial;
}

/** Apply shader to the whole model */
/**
 * Uses {@link applyShaderMaterial} to apply the new shader material to the model.
 * @param {THREE.Object3D} model - The object to apply the new shader material to.
 */
function applyShaderMaterialToModel(model) {
  if (model) {
    model.traverse((node) => {
      if (node instanceof THREE.Mesh && node.geometry && node.material) {
        const userData = node.geometry.userData;
        applyShaderMaterial(node, userData, node.material);
      }
    });
  }
}

// Handle shader selection change from HTML dropdown
document.getElementById('shaderSelector').addEventListener('change', function () {
  activeShaderClassName = this.value;

  const dir = shaders[activeShaderClassName].defaultLightDirection;
  // Update light direction inputs based on the selected shader's defaults
  document.getElementById('lightDirX').value = dir.x;
  document.getElementById('lightDirY').value = dir.y;
  document.getElementById('lightDirZ').value = dir.z;

  if (model) {
    applyShaderMaterialToModel(model); // Apply the selected shader to the model
    updateLightDirection(); // Apply the new light direction immediately
  }
});

// // ---------------------------------------------------------------------
// //  Begin Scene
// // ---------------------------------------------------------------------

// Set up the scene, camera, and renderer
const scene = new THREE.Scene();

// Set a pastel purple background color
// already set by html background
scene.background = new THREE.Color(0xE6E6FA); // Light lavender

// Perspective camera with specified parameters
/** Field of view in degrees */
const fov = 15;
/** Aspect ratio */
const aspect = window.innerWidth / window.innerHeight;
/** Near clipping plane */
const near = 10;
/** Far clipping plane */
const far = 10000;
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
let isRotating = true;
let rotationSpeed = parseFloat(document.getElementById('rotationSpeed').value);

// Variable to hold the loaded model
/** @type {THREE.Object3D|null} */
let model = null;

// Select the Load Model button to later disable/re-enable it
const loadModelButton = /** @type {HTMLButtonElement|null} */ (document.getElementById('loadModelButton'));

// // ---------------------------------------------------------------------
// //  Model Loading
// // ---------------------------------------------------------------------
/**
 * Loads the glTF model into {@link model} from a URL.
 * @param {string} url - The URL to the glTF model.
 */
const loadModel = (url) => {
  // Disable the Load Model button when loading starts
  if (loadModelButton) {
    loadModelButton.disabled = true;
  }

  // Remove existing model if any
  if (model) {
    scene.remove(model);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material.map) {
          child.material.map.dispose();
        }
        child.material.dispose();
      }
    });
    model = null;
  }

  // Instantiate the GLTFLoader
  const loader = new THREE.GLTFLoader();

  // Load the glTF model
  loader.load(
    url,
    /** @param {{scene: THREE.Group}} gltf - The model loaded from the GLTFLoader. */
    (gltf) => {
      // Extract the loaded scene/model
      model = gltf.scene;

      applyShaderMaterialToModel(model); // Apply shader to new model
      updateLightDirection(); // Apply light direction to new model

      // Add the model to the scene
      scene.add(model);

      // Re-enable the Load Model button after loading completes
      loadModelButton.disabled = false;
    },
    undefined,
    (error) => {
      console.error('An error occurred while loading the model:', error);
      alert('An error occurred while loading the model: ' + error.toString());
      // Re-enable the Load Model button if there's an error
      loadModelButton.disabled = false;
    }
  );
};

/** Animation loop */
const animate = () => {
  requestAnimationFrame(animate);

  // Rotate the model around the Y-axis if rotation is enabled
  if (model && isRotating) {
    model.rotation.y += rotationSpeed;
  }

  // Render the scene from the camera's perspective
  renderer.render(scene, camera);
};

// Handle window resize events
window.addEventListener(
  'resize',
  () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  },
  false
);

// Handle form submission to load a new model
document.getElementById('modelForm').addEventListener('submit', (event) => {
  event.preventDefault(); // Prevent the default form submission behavior
  const url = document.getElementById('modelUrl').value.trim();
  // Load the model from the URL.
  if (url) {
    loadModel(url);
  } else {
    alert('Please enter a URL to a valid model in glTF format.');
  }
});

/** Tracks if rotation is paused via the pause button */
let isPausedByButton = false;
/** Tracks if rotation is paused via mouse interaction */
let isPausedByMouse = false;

// Handle pause and resume buttons visibility and rotation state
document.getElementById('pauseButton').addEventListener('click', function () {
  isPausedByButton = true;
  isRotating = false;
  document.getElementById('pauseButton').style.display = 'none';
  document.getElementById('resumeButton').style.display = 'block';
});

document.getElementById('resumeButton').addEventListener('click', function () {
  isPausedByButton = false;
  isRotating = true;
  document.getElementById('pauseButton').style.display = 'block';
  document.getElementById('resumeButton').style.display = 'none';
});

// Add event listeners to the renderer's DOM element for mouse interactions
renderer.domElement.addEventListener('pointerdown', () => {
  if (!isPausedByButton && isRotating) {
    isRotating = false;
    isPausedByMouse = true;
  }
});

// Handle mouse up event to restart rotation if it wasn't paused by the button
renderer.domElement.addEventListener('pointerup', () => {
  if (isPausedByMouse && !isPausedByButton) {
    isRotating = true;
    isPausedByMouse = false;
  }
});

// Handle rotation speed slider
/** @type {HTMLInputElement|null} */ (document.getElementById('rotationSpeed'))
  .addEventListener('input', function () {
    rotationSpeed = parseFloat(this.value) || 0;
  });

// Toggle UI functionality
const hideUiButton = document.getElementById('hideUiButton');
const showUiButton = document.getElementById('showUiButton');
const ui = document.getElementById('ui');

hideUiButton.addEventListener('click', () => {
  ui.style.display = 'none';
  showUiButton.style.display = '';
});
showUiButton.addEventListener('click', () => {
  ui.style.display = '';
  showUiButton.style.display = 'none';
});

// // ---------------------------------------------------------------------
// //  Light Direction Handling
// // ---------------------------------------------------------------------
/** Updates the light direction according to the selectors. */
const updateLightDirection = () => {
  const x = parseFloat(document.getElementById('lightDirX').value);
  const y = parseFloat(document.getElementById('lightDirY').value);
  const z = parseFloat(document.getElementById('lightDirZ').value);
  const newDir = new THREE.Vector3(x, y, z);//.normalize();

  if (model) {
    model.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material && node.material.lightDirection) {
        node.material.lightDirection = newDir;
      }
    });
  }
};

// Attach event listeners to light direction sliders
['lightDirX', 'lightDirY', 'lightDirZ'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateLightDirection);
});

// // ---------------------------------------------------------------------
// //  Reset Light Direction
// // ---------------------------------------------------------------------
/** Resets the light direction to the shader's default. */
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
  .getElementById('resetLightButton')
  .addEventListener('click', resetLightDirection);

// Load the default model on startup
loadModel(document.getElementById('modelUrl').value);

// Start the animation loop
animate();
