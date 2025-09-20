/*!
 * @file Mii rendering with body, accurate scaling,
 * all shaders, shadow, and head model from glTF.
 *
 * Uses SkeletonScalingExtensions to support body scaling by extending THREE.Skeleton.
 * Definitions for how to scale each body model are in ModelScaleDesc.js.
 * Shader material classes are included (as UMD) from FFL.js.
 *
 * Mii head models are consumed from glTFs made from
 * mii-unsecure.ariankordi.net/FFL-Testing GLTFExportCallback.
 * This was also made with the goal to hopefully be
 * flexible enough to accept Mii head models from FFL.js.
 *
 *
 * Code to achieve accurate Mii body scaling has been initially
 * reverse engineered/decompiled from nn::mii::VariableIconBody
 * by me, implemented in C++ here: https://github.com/ariankordi/FFL-Testing/blob/renderer-server-prototype/src/BodyModel.cpp
 * Please credit me if you use any portion of this.
 * Originally published on jsfiddle.net: https://jsfiddle.net/u/arian_/fiddles/
 * @author Arian Kordi <https://github.com/ariankordi>
 */

// @ts-check

//! File: SkeletonScalingExtensions.js
/*!
 * @file Extensions for Three.js to help allow per-bone scaling of skeletons.
 * @author Arian Kordi <https://github.com/ariankordi>
 */

// @ts-check
/*
Helpful references:
- [ ] https://github.com/lo-th/phy/blob/main/src/3TH/character/SkeletonExtand.js
- [ ] https://github.com/lo-th/lab/blob/master/src/lth/Skeleton_Add.js
- [ ] https://github.com/lo-th/Avatar.lab/blob/gh-pages/src/skeleton.js
Author of the THREE.Skeleton.prototype.update override, and
thus this entire method for scaling a model, is lo-th.
All other references I found on GitHub were simply copying his code.
*/

// // ---------------------------------------------------------------------
// //  Extensions for Skeleton Scaling
// // ---------------------------------------------------------------------

/**
 * A description for a model attached to a bone on a {@link THREE.Skeleton}.
 * This kind of attachment will follow the position of a scaled bone
 * while also allowing the attached model to maintain its own separate scale.
 * @typedef {{
 * obj: THREE.Object3D,
 * boneIdx: number,
 * localScale: THREE.Vector3|null
 * }} SkeletonAttachment
 */

/**
 * Custom version of {@link THREE.Skeleton} to add attachments.
 * @typedef {THREE.Skeleton & {
 * _attachments: Array<SkeletonAttachment>|undefined,
 * attach: function(THREE.Object3D, string, boolean=): void,
 * detach: function(THREE.Object3D): void
 * detachAll: function(): void
 * }} SkeletonWithAttachments
 */

/**
 * Custom version of {@link THREE.Bone} with custom scaling properties.
 * Note that the misspelled "scalling" name is still used from lo-th's original code.
 * @typedef {THREE.Bone & {
 * scalling: THREE.Vector3|undefined,
 * scaleForRootAdjust: THREE.Vector3Like|undefined,
 * }} BoneWithScaling
 */

/**
 * Adds extensions (override functions) to the THREE.Skeleton namespace ({@link THREE.Skeleton})
 * to enable hierarchical per-bone local scaling for Three.js skeletons.
 * @param {typeof THREE.Skeleton} Skeleton - The THREE.Skeleton class.
 */
function addSkeletonScalingExtensions(Skeleton) {
	if (/** @type {*} */ (Skeleton.prototype)._attachments) {
		console.warn('addSkeletonScalingExtensions: Already run, skipping.');
		return; // Already run, skip this.
	}

	// Replace function that runs every time a skeleton is updated.
	// Original function (r178, 2025, functionality is simple):
	// https://github.com/mrdoob/three.js/blob/e117b283555e0ccc5034fa5193b951bc987280ed/src/objects/Skeleton.js#L198
	Skeleton.prototype.update = (function () {
		// Static, shared variables to be used temporarily for every run.

		/** @readonly */ // - (Below two are defined in three.js Skeleton.js)
		const _identityMatrix = new THREE.Matrix4().identity();
		// Used in main bone scale loop:
		const _offsetMatrix = new THREE.Matrix4();

		const scaleMatrix = new THREE.Matrix4();
		const posVec = new THREE.Vector3();

		// Used for decomposing/composing when updating attachments:
		const tmpQuat = new THREE.Quaternion();
		const tmpTrans = new THREE.Vector3();

		/**
		 * Adjusts translation, if the parent is the root (skl_root).
		 * @param {BoneWithScaling} bone - The bone to check/adjust for.
		 * @param {THREE.Matrix4} matrix - The local matrix.
		 */
		function adjustTranslationForRoot(bone, matrix) {
			// Run if: this bone has a parent bone, and the parent is skl_root.
			if (!bone.scalling || !(bone.parent instanceof THREE.Bone) ||
				// scaleForRootAdjust being present indicates that parent is the root.
				!(/** @type {BoneWithScaling} */ (bone.parent).scaleForRootAdjust)) {
				return;
			}
			// if (!bone.scalling || !bone.isScallingRoot) return;

			// Get translation/W-axis from matrix.
			const translation = tmpTrans.setFromMatrixPosition(matrix);
			// Use the scale vector to adjust translation.
			const scale = /** @type {THREE.Vector3Like} */
				(/** @type {BoneWithScaling} */ (bone.parent).scaleForRootAdjust);

			// Multiply translation by YYX axes:
			translation.x *= scale.y;
			translation.y *= scale.y;
			translation.z *= scale.x;
			// Move Y down to keep the model's root (legs) planted.
			translation.y += (scale.x - scale.y); //* 1.0;
			// 1.0 = Local-to-world scale of the body model.

			matrix.setPosition(translation); // Set translation back on matrix.
		}

		/**
		 * @param {Array<SkeletonAttachment>} attachments - The attachment array.
		 * @param {typeof THREE.Skeleton.prototype.boneMatrices} boneMatrices -
		 * The raw matrices array to update the attachment with.
		 */
		function updateAttachments(attachments, boneMatrices) {
			for (const at of attachments) {
				// _offsetMatrix - Temporary matrix for the bone's worldMatrix.
				// scaleMatrix - Temporary matrix for the inverted parent.

				// Get the world matrix of the bone we just fed to skinning:
				_offsetMatrix.fromArray(boneMatrices, at.boneIdx * 16); // Already scaled.

				// The caller wants to preserve the attachment's own local scale.
				if (at.localScale) {
					// Remove the bone's scale by re-composing with the local scale.
					_offsetMatrix.decompose(tmpTrans, tmpQuat, posVec);
					_offsetMatrix.compose(tmpTrans, tmpQuat, at.localScale);
				}

				// Copy bone-space to world-space for the attachment.
				// at.obj.matrixWorld.copy(_offsetMatrix);// .multiply(at.local);
				// at.obj.matrixWorldNeedsUpdate = false; // Make the matrix stay put.

				/** The world matrix of the object's parent, or identity if there is none. */
				const parentWorld = at.obj.parent ? at.obj.parent.matrixWorld : _identityMatrix;
				scaleMatrix.copy(parentWorld).invert(); // Convert world to local matrix.

				// Multiply two matrices and store result in the object's matrix.
				at.obj.matrix.multiplyMatrices(scaleMatrix, _offsetMatrix);
				at.obj.updateMatrixWorld(true); // Update now. (Not recommended to change directly.)
			}
		}

		/**
		 * Override of the update function to apply per-bone scaling and attachments.
		 * In the author (https://github.com/lo-th)'s words: "force local scalling"
		 * From lab (2019): https://github.com/lo-th/lab/blob/5e8949f3202a952df2269e80f40a93f362cf22aa/src/lth/Skeleton_Add.js#L136
		 * From Avatar.lab (2017): https://github.com/lo-th/Avatar.lab/blob/e96e7f3862c04feb7ce9fb6744561ffb8661fb21/src/skeleton.js#L5
		 * @this {SkeletonWithAttachments}
		 */
		return function update() {
			// For each bone, compute world matrix and then apply custom scaling.
			for (let i = 0; i < this.bones.length; i++) { // Flatten bone matrices to array.
				const bone = /** @type {BoneWithScaling|undefined} */ (this.bones[i]);
				// Compute the offset between the current and the original transform.
				let matrix = bone ? bone.matrixWorld : _identityMatrix;

				// If user provided bone.scalling (note spelling!), apply it to the bone:
				if (bone && bone.scalling) {
					matrix = matrix.clone().scale(bone.scalling);

					// Adjust translation for the root (skl_root).
					// if (bone.parent && bone.parent instanceof THREE.Bone &&
					//	 bone.scalling && /** @type {BoneWithScaling} */ (bone.parent)
					//	 .isScallingRoot) {
					adjustTranslationForRoot(bone, matrix);

					// Re-position children so they follow the scaled parent.
					for (const child of bone.children) {
						scaleMatrix.copy(matrix).multiply(child.matrix);
						posVec.setFromMatrixPosition(scaleMatrix);
						child.matrixWorld.setPosition(posVec);
					}
				}

				// Update boneMatrices[] (like the original update function)
				_offsetMatrix.multiplyMatrices(matrix, this.boneInverses[i]);
				_offsetMatrix.toArray(this.boneMatrices, i * 16);
			}

			// Update all registered attachments after bones are updated.
			if (this._attachments) {
				updateAttachments(this._attachments, this.boneMatrices);
			}

			// Finally, update boneTexture (like the original update function)
			if (this.boneTexture) {
				this.boneTexture.needsUpdate = true;
			}
		};
	})();

	// Define SkeletonWithAttachments extensions.

	/** @type {SkeletonWithAttachments} */ (Skeleton.prototype).attach =
	/**
	 * @param {THREE.Object3D} obj - The Object3D to attach (SkinnedMesh, glTF scene, etc.)
	 * @param {string} boneName - Bone name to look up once.
	 * @param {boolean} [useBoneScale] - If this is false, then the bone's individual
	 * scale is ignored, and the object's local scale will be used when attaching.
	 * @throws {Error} Throws if the bone specified in `boneName` cannot be found.
	 * @this {SkeletonWithAttachments}
	 */
	function (obj, boneName, useBoneScale = false) {
		const boneIdx = this.bones.findIndex(b => b.name === boneName);
		if (boneIdx < 0) {
			throw new Error(`Bone '${boneName}' not found.`);
		}

		// Turn off auto‐updates so our manual matrix stays put.
		obj.matrixAutoUpdate = false;
		// obj.matrixWorldAutoUpdate = false; // Not modifying matrixWorld directly.

		const localScale = !useBoneScale ? obj.scale : null;
		/** @type {SkeletonAttachment} */
		const att = { obj, boneIdx, localScale };

		// Add the attachment or create the _attachments array.
		if (this._attachments) {
			this._attachments.push(att);
		} else {
			this._attachments = [att];
		}
		// this.update(); // Update the attachment instantly. (Not needed)
	};

	/** @type {SkeletonWithAttachments} */ (Skeleton.prototype).detach =
	/**
	 * @param {THREE.Object3D} obj - The object to detach.
	 * @this {SkeletonWithAttachments}
	 */
	function (obj) {
		if (this._attachments) {
			this._attachments = this._attachments.filter(a => a.obj !== obj);
		}
	};

	/** @type {SkeletonWithAttachments} */ (Skeleton.prototype).detachAll =
	function () {
		this._attachments = null;
	};
}

//export { addSkeletonScalingExtensions };
//! End file: SkeletonScalingExtensions.js

//! File: BodyScaleDesc.js
/*!
 * @file Descriptions (tables) of how to scale
 * different Mii body models and their bone names.
 * @author Arian Kordi <https://github.com/ariankordi>
 */

// // ---------------------------------------------------------------------
// //  Descriptions for Body Model Scaling
// // ---------------------------------------------------------------------

/**
 * Describes the ways in which to apply the scale vector on
 * the model's bones. Each array represents names of bones.
 * @typedef {Object} ModelScaleDesc
 * @property {Array<string>|null} xyz - List of bones that should be scaled with the unmodified scale vector.
 * If null, then all bones will receive the unmodified scale vector, unless ones excluded in `none`.
 * @property {Array<string>} xyzClampY - List of bones that should be scaled with all three dimensions
 * of the scale vector, but with Y clamped to 1.0. Used for the head bone in nn::mii.
 * @property {Array<string>|null} yxz - List of bones that should be scaled using the scale vector with Y and X swapped.
 * If null, then all bones will receive the the vector with Y and X swapped, unless ones excluded in `none`.
 * @property {Array<string>} scalar - List of bones that should be scaled uniformly using X for all dimensions.
 * @property {Array<string>|null} none - List of bones that should receive no additional scale.
 * Only applicable if `xyz` or `yxz` are non-null.
 * @property {string} root - The name of the root bone for which to adjust translation
 * (usually something along the lines of "skl_root").
 * @property {string} head - The name of the bone for which to attach the model's head.
 * NOTE: The head bone is not necessarily used for scaling, but is provided here for convenience.
 * @property {string} shadow - The name of a bone that is planted at the bottom of
 * the skeleton, and receives scalar scale. This is used for attaching the shadow model.
 */

/**
 * Scaling description for the body model used in the editor.
 * Tested with Wii U (MiiBodyMiddle.bfres) and Switch (MiiBodyHigh.bfres) body models.
 * Also tested with the Wii (Mii Channel) body model, and the 3DS body should work too.
 * This model is mostly unused outside of system titles and certain first-party Wii channels (Wii Room).
 * Main reference: mii_VariableIconBodyImpl.o from NintendoSDK,
 * void nn::mii::detail::`anonymous namespace'::UpdateScale(class nn::util::Vector3f *,
 * enum nn::mii::detail::VriableIconBodyBoneKind, struct nn::util::Float3 const &)
 * @type {ModelScaleDesc}
 */
const editorBodyScaleDesc = {
	root: 'skl_root', // Adjust translation based on skl_root.
	head: 'head', // Head bone.
	xyz: null, // Let all bones receive full XYZ scale by default.
	xyzClampY: [], // Switch body clamps Y on head. Wii U does not do this.
	// The arms and elbows receive YXZ scale.
	yxz: ['arm_l1', 'arm_l2', 'arm_r1', 'arm_r2', 'elbow_l', 'elbow_r'],
	// Wrist, Shoulder, Ankle, Knee
	scalar: ['wrist_l', 'wrist_r', 'shoulder_l', 'shoulder_r',
		'ankle_l', 'ankle_r', 'knee_l', 'knee_r',
		'body'], // The shadow, which receives scalar scale, can be attached to body.
	shadow: 'body',
	none: ['all_root'] // Do not scale all_root.
	// NOTE: Bone whitelist or blacklist? This is using blacklist, but perhaps
	// for models with more bones/roots, a whitelist will cause less problems.
};
// How is the shadow scaled in the editor?

/**
 * Scaling description for the body model used in Miitomo, which
 * is similar to the model used in Tomodachi Life 3DS.
 * In contrast to the editor body, its bones use YXZ scale by default.
 * Reference: FUN_005357f0 in libcocos2dcpp.so 2.4.0 (inlined anim lerp/body scaling)
 * @type {ModelScaleDesc}
 */
const archBodyScaleDesc = {
	root: 'Skl_Root',
	head: 'Head', // Head bone. Note that there is also "z_Head".
	xyz: [], // No bones are receiving XYZ scale.
	xyzClampY: [],
	yxz: null, // All bones receive YXZ scale by default.
	// Wrist, Ankle (no shoulders, knees)
	scalar: ['Ankle_R', 'Ankle_L', 'Wrist_R', 'Wrist_L'],
	shadow: 'Waist', // TODO: Need to find a good shadow anchor. How did this work originally?
	// Above are referenced in body scale func. (Other bones are not mentioned by strings)
	// At the beginning of body scale func, jointRoot and Head are skipped.
	none: ['jointRoot', 'Head', 'nw4f_root'/** < For Super Mario Maker 2 bfres */]
	// TODO: Special handling is needed for: Shadow, Acce_Spine_*, Item_Wrist_*, Item_Spine_*
};

// Potential body models to use from games:
// - (3DS) Tomodachi Life //<- Similar appearance to Miitomo.
//   - all_root, head, R_ankle, L_ankle, R_hand1, L_hand1, shadow, (waist/L_hand)Item
// - (3DS) StreetPass Mii Plaza //<- No arms/legs, floating hands, outfits.
// - (Wii) Wii Sports, Wii Fit, Wii Party //<- Human-like hands.
// - (Wii U) Wii Karaoke U by JOYSOUND //<- Cute outfits.
// - (3DS, Switch) Miitopia //<- Shorter body.
// - (3DS) AKB48+Me, Dillon's Dead-Heat Breakers //<- Outfits.
// - (Wii U) Super Smash Bros. for Wii U, Mario Kart 8

/**
 * Detects and returns the appropriate {@link ModelScaleDesc} for the body model.
 * Currently just differentiates between editor's body model and Miitomo body model.
 * @param {THREE.Object3D} object - The model for which to detect the description.
 * @returns {ModelScaleDesc} The `ModelScaleDesc` that was detected.
 * @throws {Error} Throws if the `ModelScaleDesc` could not be detected.
 */
function detectModelDesc(object) {
	/** @type {ModelScaleDesc|null} */
	let desc = null;

	// Since the name/capitalization of skl_root differs,
	// this will be used to differentiate between editor and Miitomo body.
	object.traverse((bone) => {
		// if (!(bone instanceof THREE.Bone)) {
		// 	return;
		// }
		// ^^ may not work reliably? because some are nodes...?
		switch (bone.name) {
			case 'Skl_Root':
				desc = archBodyScaleDesc;
				break;
			case 'skl_root':
				desc = editorBodyScaleDesc;
				break;
			case 'L_leg': // Unique for Tomodachi Life 3DS model
				desc = archBodyScaleDesc; // tomodachiBodyScaleDesc;
				break;
		}
	});

	if (!desc) {
		throw new Error('detectModelDesc: Could not detect based on bone names.');
	}

	return desc;
}

/**
 * Apply scaling to a model's bones based on a given scale description.
 * @param {THREE.Object3D} model - The skinned model to apply scaling to.
 * @param {THREE.Vector3Like} scaleVector - The base scale vector.
 * @param {ModelScaleDesc} desc - Scaling behavior descriptor for the model.
 * @throws {Error} Throws if addSkeletonScalingExtensions has not been called yet.
 */
function applyScaleDesc(model, scaleVector, desc) {
	if (!('attach' in THREE.Skeleton.prototype)) { // Notify the caller if this won't work.
		throw new Error('applyScaleDescription: This function to apply "scalling" has no effect, until "addSkeletonScalingExtensions" is run to patch THREE.Skeleton.prototype to allow per-bone scaling. Try running that first.');
	}

	/** The final head bone to be set and returned later. */
	// let headBone = null;

	model.traverse((node) => {
		if (!(node instanceof THREE.Bone)) {
			return;
		}
		const bone = /** @type {BoneWithScaling} */ (node);

		const name = bone.name;

		// Mark root to be used for translation adjustment.
		if (name === desc.root) {
			bone.scaleForRootAdjust = scaleVector; // Set scale vector to be used.
			return;
		}

		// Skip if explicitly listed in `none`.
		if (desc.none?.includes(bone.name)) {
			return;
		}

		/** Final scale vector to be determined for the bone. */
		const scale = new THREE.Vector3();

		// Test for XYZ, YXZ, Y-clamp, and scalar.
		if (desc.xyz?.includes(name)) {
			// console.debug('xyz:', name);
			scale.set(scaleVector.x, scaleVector.y, scaleVector.z);
		} else if (desc.yxz?.includes(name)) {
			// console.debug('yxz:', name);
			scale.set(scaleVector.y, scaleVector.x, scaleVector.z);
		} else if (desc.scalar.includes(name)) {
			// console.debug('scalar:', name);
			scale.setScalar(scaleVector.x);
		} else if (desc.xyzClampY.includes(name)) {
			scale.set(scaleVector.x, Math.min(scaleVector.y, 1.0), scaleVector.z);
		} else {
			// Default: Either xyz, yxz, or no scale.
			if (desc.xyz === null) {
				// console.debug('xyz:', name);
				scale.set(scaleVector.x, scaleVector.y, scaleVector.z);
			} else if (desc.yxz === null) {
				// console.debug('yxz:', name);
				scale.set(scaleVector.y, scaleVector.x, scaleVector.z);
			}
			// Else, do not set scale.
		}

		bone.scalling = scale;

		// Set `headBone` local.
		/* if (name === desc.head) {
			headBone = bone;
		} */
	});

	// Eager skeleton update (to avoid deferred frame-lagged updates).
	const skinned = model.getObjectByProperty('type', 'SkinnedMesh');
	if (skinned && skinned instanceof THREE.SkinnedMesh) {
		skinned.skeleton.update();
	}
	// It will still update without this, but the update will be delayed.

	// return headBone; // @returns {THREE.Bone|null} The head bone, if specified in the descriptor.
}

/*
export {
	editorBodyScaleDesc,
	archBodyScaleDesc,
	detectModelDesc,
	applyScaleDesc
};
*/
//! End file: BodyScaleDesc.js


import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // Optional.
// Dependencies for body scaling.
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
//import { addSkeletonScalingExtensions } from './SkeletonScalingExtensions.js';
//import { detectModelDesc, applyScaleDesc } from './ModelScaleDesc.js';
// All UMDs below:
import * as FFLShaderMaterialImport from './FFL.js/FFLShaderMaterial.js';
import * as LUTShaderMaterialImport from './FFL.js/LUTShaderMaterial.js';
import * as SampleShaderMaterialImport from './FFL.js/SampleShaderMaterial.js';

// JSDoc include statements, needed for UMD imports.
/**
 * @typedef {import('three')} THREE
 * @typedef {import('./FFL.js/FFLShaderMaterial.js')} FFLShaderMaterial
 * @typedef {import('./FFL.js/LUTShaderMaterial.js')} LUTShaderMaterial
 * @typedef {import('./FFL.js/SampleShaderMaterial.js')} SampleShaderMaterial
 * Imports for standalone JSDoc types:
 * @typedef {import('./FFL.js/SampleShaderMaterial.js').SampleShaderMaterialColorInfo} SampleShaderMaterialColorInfo
 * @nottypedef {import('./SkeletonScalingExtensions.js').SkeletonWithAttachments} SkeletonWithAttachments
 * @nottypedef {import('./ModelScaleDesc.js').ModelScaleDesc} ModelScaleDesc
 */

// Hack to include modules as UMD or ESM. This should be removed
// if the modules are all converted to ESM.

/* eslint-disable no-self-assign -- Get TypeScript to identify global imports. */
/** @type {FFLShaderMaterial} */
let FFLShaderMaterial = /** @type {*} */ (globalThis).FFLShaderMaterial;
FFLShaderMaterial = (!FFLShaderMaterial) ? FFLShaderMaterialImport : FFLShaderMaterial;
/** @type {LUTShaderMaterial} */
let LUTShaderMaterial = /** @type {*} */ (globalThis).LUTShaderMaterial;
LUTShaderMaterial = (!LUTShaderMaterial) ? LUTShaderMaterialImport : LUTShaderMaterial;
/** @type {SampleShaderMaterial} */
let SampleShaderMaterial = /** @type {*} */ (globalThis).SampleShaderMaterial;
SampleShaderMaterial = (!SampleShaderMaterial) ? SampleShaderMaterialImport : SampleShaderMaterial;

globalThis.THREE = /** @type {THREE} */ (/** @type {*} */ (globalThis).THREE);
/* eslint-enable no-self-assign -- Get TypeScript to identify global imports. */

// Define OrbitControls and GLTFLoader even if they were loaded from UMD.
if ('OrbitControls' in THREE) {
	globalThis.OrbitControls =
		// eslint-disable-next-line import/namespace -- not explicitly imported
		/** @type {import('three/examples/jsm/controls/OrbitControls.js')} */ (THREE.OrbitControls);
}
if ('GLTFLoader' in THREE) {
	globalThis.GLTFLoader =
		// eslint-disable-next-line import/namespace -- not explicitly imported
		/** @type {import('three/examples/jsm/loaders/GLTFLoader.js')} */ (THREE.GLTFLoader);
}

// Enable extensions to Three.js needed to enable body scaling.
addSkeletonScalingExtensions(THREE.Skeleton); // Only call once.

/**
 * Global object for storing all available material classes.
 * @type {Object<string, function(new: import('three').Material, ...*): import('three').Material>}
 */
const materials = {
	// from ffl.js
	FFLShaderMaterial, LUTShaderMaterial, SampleShaderMaterial
};

const getDataBodyUrl = (/** @type {HTMLElement|null} */ element) => {
	let a;
	if (!element || !(a = element.getAttribute('data-body-url'))) {
		throw new Error('Element with data-body-url attribute not found.');
	}
	return a;
};

// URLs for body models.
const maleBodyUrl = getDataBodyUrl(document.querySelector('[value="0"][data-body-url]'));
const femaleBodyUrl = getDataBodyUrl(document.querySelector('[value="1"][data-body-url]'));
// TODO: It may be worth having different "sets" of the two models.

// // ---------------------------------------------------------------------
// //  Mii Definitions (All below are available in FFL.js.)
// //  Gender, getBodyScale, favorite and pants colors
// // ---------------------------------------------------------------------

/**
 * Genders for each body model.
 * @enum {number}
 */
const Gender = {
	Male: 0,
	Female: 1
};

/**
 * Also available in FFL.js as CharModel.getBodyScale().
 * @param {number} build - Build value from 0-127.
 * @param {number} height - Height value from 0-127.
 * @returns {THREE.Vector3Like} Scale vector for the body model.
 */
function getBodyScale(build, height) {
	// calculated here in libnn_mii/draw/src/detail/mii_VariableIconBodyImpl.cpp:
	// void nn::mii::detail::`anonymous namespace'::GetBodyScale(struct nn::util::Float3 *, int, int)
	// also in Mii Maker USA (0x000500101004A100 v50 ffl_app.rpx): FUN_020737b8
	const m = 128.0;
	const x = (build * (height * (0.47 / m) + 0.4)) / m +
		height * (0.23 / m) + 0.4;
	const y = (height * (0.77 / m)) + 0.5;

	return { x, y, z: x }; // z is always set to x
}

/* Generate below table using:
function floatsToHex(r, g, b) {
  const ri = Math.round(parseFloat(r) * 255);
  const gi = Math.round(parseFloat(g) * 255);
  const bi = Math.round(parseFloat(b) * 255);
  return (ri << 16) | (gi << 8) | bi;
}
const favoriteColorTable = source
  .trim()
  .split(/\n/)
  .map(line => {
    const nums = line.match(/[\d.]+/g); // grab numbers
    if (!nums) return null;
    const hex = floatsToHex(nums[0], nums[1], nums[2]);
    return `new THREE.Color(0x${hex.toString(16).padStart(6, "0")})`;
  })
  .filter(Boolean);
  console.log("const favoriteColorTable = [\n\t" + favoriteColorTable.join(",\n\t") + "\n];");
*/
/**
 * Mii favorite color to THREE.Color table.
 * Reference: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/src/FFLiColor.cpp#L324-L337
 */
const favoriteColorTable = [
	0xd21e14, 0xff6e19, 0xffd820, 0x78d220, 0x007830,
	0x0a48b4, 0x3caade, 0xf55a7d, 0x7328ad, 0x483818,
	0xe0e0e0, 0x181814
];

/** Constant pants color used. */
const pantsColorGrayNormal = 0x40474E;

// // ---------------------------------------------------------------------
// //  Globals, Renderer State, Mii Model Properties
// // ---------------------------------------------------------------------

/** @type {import('three').Scene} */
let scene;
/** @type {import('three').WebGLRenderer} */
let renderer;
/** @type {import('three').PerspectiveCamera} */
let camera;
/** @type {import('three/examples/jsm/controls/OrbitControls.js').OrbitControls} */
let controls;
// Animation-related state.
/** @type {THREE.AnimationMixer|null} */
let mixer = null;
/** @type {THREE.Clock} */
const clock = new THREE.Clock();

let isRotating = false;
let rotationSpeed = 8;

/**
 * A body model with its ModelScaleDesc and animations altogether.
 * @typedef {Object} BodyModel
 * @property {THREE.Object3D} model
 * @property {Array<THREE.AnimationClip>} animations - AnimationClips from the glTF.
 * @property {ModelScaleDesc} scaleDesc
 */

/**
 * Contains body models for each gender.
 * The value is the GLTFLoader GLTF type, since it contains animations.
 * @type {Record<Gender, import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>}
 */
const bodyTemplates = [];

// State of Mii models in the scene.
/** @type {THREE.Group|null} */
let currentHead = null;
/** @type {BodyModel|null} */
let currentBody = null;
/** @type {THREE.Mesh|null} */
let currentShadowModel = null;

let activeMaterialClassName = Object.keys(materials)[0];

/** Mii properties extracted from the loaded head model. */
const additionalInfo = {
	gender: Gender.Female,
	favoriteColor: 11, // Black
	height: 28,
	build: 55,
	// All of the above are available in FFLAdditionalInfo.
	/**
	 * Info needed from Switch shader. This is available from
	 * the charInfo Base64 in glTF models, or .getColorInfo() for FFL.js CharModel.
	 * @type {SampleShaderMaterialColorInfo|null}
	 */
	colorInfo: null
};
// Current properties for the Mii model.
let build = 55;
let height = 28;
let gender = Gender.Female;

// // ---------------------------------------------------------------------
// //  Scene Setup
// // ---------------------------------------------------------------------

/**
 * Adds {@link THREE.AmbientLight} and {@link THREE.DirectionalLight} to
 * a scene, using values similar to what the FFLShader is using.
 * @param {import('three').Scene} scene - The scene to add lights to.
 * @todo Why does it look worse when WebGLRenderer.useLegacyLights is not enabled?
 */
function addLightsToScene(scene) {
	const intensity = Number(THREE.REVISION) >= 155 ? Math.PI : 1.0;
	const ambientLight = new THREE.AmbientLight(new THREE.Color(0.73, 0.73, 0.73), intensity);
	const directionalLight = new THREE.DirectionalLight(
		new THREE.Color(0.60, 0.60, 0.60), intensity);
	directionalLight.position.set(-0.455, 0.348, 0.5);
	scene.add(ambientLight, directionalLight);
}

/** The working color space, needed to set colors from hex without conversion. */
const workingSpace = THREE.ColorManagement ? THREE.ColorManagement.workingColorSpace : '';
/**
 * Loads a hex color that is always in the current space, assumed to be sRGB.
 * @param {number} hex - Hexadecimal/numerical color value.
 * @returns {import('three').Color} The THREE.Color corresponding to the value.
 */
const colorFromHex = hex => new THREE.Color().setHex(hex, workingSpace);

/**
 * Initializes the Three.js renderer, scene,
 * camera, controls, lights, and adds a grid.
 */
function initRendererAndScene() {
	// Create and initialize scene.
	scene = new THREE.Scene();
	scene.background = colorFromHex(0xE6E6FA);

	// Create the WebGLRenderer with antialiasing for more visual appeal.
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

	addLightsToScene(scene);

	// Opt-out of color management and stick with sRGB.
	if (THREE.ColorManagement) {
		THREE.ColorManagement.enabled = false; // Ensures Color3s will be treated as sRGB.
	}
	renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // Makes shaders work in sRGB

	// Create camera.
	camera = new THREE.PerspectiveCamera(15,
		window.innerWidth / window.innerHeight, 10, 3000);
	camera.position.set(0.0, 11.0, 120);

	// @ts-ignore -- PerspectiveCamera is not assignable to Camera in my version?
	controls = new OrbitControls(camera, renderer.domElement);
	controls.minDistance = 8;
	controls.maxDistance = 2000;
	controls.target.set(0, 8.0, 0);
	controls.update();
	controls.autoRotate = isRotating;
	controls.autoRotateSpeed = rotationSpeed;

	// Basic resize handler.
	window.addEventListener('resize', () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	});

	// Add a grid to the scene, to help give the scene a space.
	const gridHelper = new THREE.GridHelper(100, 10);
	// If you use 7 instead of 10, it's like each
	// "unit" of the grid fits a Mii body. Lol.
	scene.add(gridHelper);
}

// // ---------------------------------------------------------------------
// //  Model Loading Helpers
// // ---------------------------------------------------------------------

/**
 * Async wrapper to load a GLTF model from URL.
 * @param {string} url - The URL to load the glTF model from.
 * @returns {Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>}
 * The GLTF object. `gltf.scene` contains the mesh group.
 */
const loadGLTF = async url =>
	new Promise((resolve, reject) => {
		new GLTFLoader().load(url, resolve, undefined, reject);
	});

/**
 * Loads and processes a head model from a glTF URL.
 * This can mimic creating a CharModel from ffl.js.
 * It applies the shader, renderOrder, and extracts props into {@link additionalInfo}.
 * @param {string} url - The URL of the glTF for the head/CharModel.
 * @returns {Promise<THREE.Group>} A new Promise that will return the head meshes in a group.
 */
async function loadCharModelFromGLTF(url) {
	const gltf = await loadGLTF(url);

	// Set additionalInfo and colorInfo from the metadata if available.
	const extras = gltf.asset.extras;
	if (extras && extras.additionalInfo) {
		const info = extras.additionalInfo;
		additionalInfo.height = info.height;
		additionalInfo.build = info.build;
		additionalInfo.gender = info.gender;
		additionalInfo.favoriteColor = info.favoriteColor;
		additionalInfo.colorInfo =
			SampleShaderMaterial.getColorInfoFromCharInfoB64(extras.charInfo);
	}

	const model = gltf.scene;

	// Apply the material class. It will read modulateMode/Type from userData.
	applyMaterialToGroup(model, activeMaterialClassName, additionalInfo.colorInfo);

	// Set material color, set renderOrder, and fix texture color space.
	model.traverse((mesh) => {
		if (!(mesh instanceof THREE.Mesh)) {
			return;
		}
		const userData = mesh.geometry.userData;
		const material = /** @type {THREE.MeshBasicMaterial} */ (mesh.material);

		if ('modulateType' in userData) {
			// Set render order for translucent meshes.
			mesh.renderOrder = userData.modulateType;
		}
		// Set the material color from modulateColor.
		// It's worth noting that the default glTF color is always in linear space.
		if (Array.isArray(userData.modulateColor)) {
			material.color = material.color.fromArray(userData.modulateColor);
		}

		// HACK: Allow the material class to modify the geometry if it needs to.
		if ('modifyBufferGeometry' in material.constructor && // Static function
			typeof material.constructor.modifyBufferGeometry === 'function') {
			material.constructor.modifyBufferGeometry(
				{ modulateParam: { type: userData.modulateType } }, mesh.geometry);
		}

		if (material.map) {
			// Force the glTF's texture to use sRGB colors.
			material.map.colorSpace = THREE.LinearSRGBColorSpace;
		}
	});

	return model;
}

/**
 * Preloads male and female body GLTFs.
 * @returns {Promise<void>} A new Promise that completes when the models are loaded.
 */
const preloadBodyTemplates = () =>
	Promise.all([loadGLTF(maleBodyUrl), loadGLTF(femaleBodyUrl)]).then((values) => {
		bodyTemplates[Gender.Male] = values[0];
		bodyTemplates[Gender.Female] = values[1];
	});

/**
 * Loads the body model for the specified gender from the glTF templates.
 * Applies a single animation from the glTF.
 * @param {Gender} gender - The gender for the model.
 * @returns {BodyModel} The body model.
 * @throws {Error} Throws if there is no model for the `genderVal`.
 * @todo This should probably be reduced to not load the animation,
 * so that it's in the caller's control if we want to swap animations.
 * It would have to return the GLTF though so the caller uses .scene/.animations.
 */
function loadBodyModel(gender) {
	const gltf = bodyTemplates[gender];
	if (!gltf) {
		throw new Error(`No body template for gender ${gender}`);
	}

	/**
	 * Cloned scene/group to avoid modifying the template.
	 * In order to maintain proper skinning/armature animations,
	 * SkeletonUtils.clone is used instead of gltf.scene.clone(true);
	 * per donmccurdy's recommendation: https://discourse.threejs.org/t/how-to-clone-a-gltf/78858/2
	 * @type {THREE.Object3D}
	 */
	const model = SkeletonUtils.clone(gltf.scene);
	// model.position.y = 45;

	// Assign one animation from the glTF model.
	const animations = gltf.animations;
	if (animations.length) {
		mixer = new THREE.AnimationMixer(model);

		// Use the animation named 'Wait' if it exists, otherwise choose the first one.
		let clip = animations.find(a => a.name === 'Wait');
		if (!clip) {
			clip = animations[0];
		}

		mixer.clipAction(clip).play()
			.setLoop(THREE.LoopRepeat, Infinity);
	}

	const scaleDesc = detectModelDesc(model);

	return { model, scaleDesc, animations };
}

// // ---------------------------------------------------------------------
// //  Body Model Setup
// // ---------------------------------------------------------------------

/**
 * Searches the Object3D for a SkinnedMesh that contains the given bone.
 * @param {THREE.Object3D} root - Where to search for the SkinnedMesh.
 * @param {string} boneName - Name of the bone in the parent SkinnedMesh to find.
 * @returns {THREE.SkinnedMesh|null} The SkinnedMesh containing the bone, or null if it was not found.
 */
function findSkinnedMeshWithBone(root, boneName) {
	let found = /** @type {THREE.SkinnedMesh|null} */ (null);
	root.traverse((node) => {
		if (found || !(node instanceof THREE.SkinnedMesh)) {
			return;
		}
		if (node.skeleton.bones.some(bone => bone.name === boneName)) {
			found = node;
		}
	});
	return found;
}

/**
 * Finds body and pants meshes, and applies modulateMode/modulateType.
 * @param {THREE.Object3D} model - The body model meshes.
 */
function applyModulateToBody(model) {
	/** @type {THREE.SkinnedMesh|null} */
	let lastSkinnedMesh = null;
	// To find the pants, let's find the last SkinndMesh and assume that's it.
	model.traverse((node) => {
		if (node instanceof THREE.SkinnedMesh) {
			lastSkinnedMesh = node;
		}
	});
	// (TODO: This method will NOT WORK for body models extracted from Miitomo PODs.)

	let meshIndex = 0;
	model.traverse((mesh) => {
		// The reason this is identifying SkinnedMesh instead of just Mesh
		// is to avoid detecting the head model. But, if the head is also
		// a SkinnedMesh and it's attached to the body, then it will catch here.
		if (!(mesh instanceof THREE.SkinnedMesh)) {
			return;
		}

		/**
		 * Assume that the mesh is pants if it is the last
		 * skinned mesh, or even. Otherwise, a it's the body.
		 */
		const isPants = lastSkinnedMesh
			? mesh.id === lastSkinnedMesh.id
			// If there is no lastSkinnedMesh, then assume this
			// is the pants if it is the second mesh.
			: (meshIndex % 2 === 0);

		mesh.geometry.userData.modulateMode = 0; // Constant color/opaque.
		mesh.geometry.userData.modulateType = isPants
			? 10 // Pants
			: 9; // Body

		meshIndex++;
	});
}

/**
 * Applies colors and the current material to the body/pants.
 * @param {THREE.Object3D} body - The body model to prepare.
 * @param {typeof additionalInfo} info - The additionalInfo representing the CharModel's traits.
 * @param {number} build - The factor determining X/Z scale/weight.
 * @param {number} height - The factor determining Y scale/height.
 */
function prepareBodyForCharModel(body, info, build, height) {
	applyModulateToBody(body); // Add modulateMode/modulateType.
	applyMaterialToGroup(body, activeMaterialClassName, info.colorInfo);

	const pantsColor = colorFromHex(pantsColorGrayNormal);
	const favoriteColor = colorFromHex(favoriteColorTable[info.favoriteColor]);

	// Set the colors on the body model.
	body.traverse((mesh) => {
		// The reason this is identifying SkinnedMesh instead of just Mesh
		// is to avoid detecting the head model. But, if the head is also
		// a SkinnedMesh and it's attached to the body, then it will catch here.
		if (!(mesh instanceof THREE.SkinnedMesh) ||
			!('modulateType' in mesh.geometry.userData)) {
			return;
		}
		if (mesh.geometry.userData.modulateType === 9) { // Body
			mesh.material.color = favoriteColor;
		} else if (mesh.geometry.userData.modulateType === 10) { // Pants
			mesh.material.color = pantsColor;
		}
	});

	updateBodyScale(body, build, height);
}

/**
 * Updates scale for the bones on the body.
 * @param {THREE.Object3D} body - The body model.
 * @param {number} build - The factor determining X/Z scale/weight.
 * @param {number} height - The factor determining Y scale/height.
 * @returns {void}
 * @todo This uses {@link detectModelDesc} every time, but that
 * could instead be stored alongside the loaded body model
 * to avoid walking through it every time.
 */
const updateBodyScale = (body, build, height) =>
	applyScaleDesc(body,
		/* scaleVector */ getBodyScale(build, height),
		/* desc */ detectModelDesc(body));

/** The absolute world-scale of the head divided by the body's scale. */
const headToBodyScale = 10.0 / 7.0;

/**
 * Attaches the head model to the body model's head bone.
 * Also calls {@link SkeletonWithAttachments.attach} so that the head
 * model's position follows the scaled head bone without getting scaled itself.
 * @param {BodyModel} body - The body model to attach the head ot.
 * @param {THREE.Group} head - The head (CharModel) to attach.
 * @throws {Error} Throws if the head bone or SkinnedMesh was not found.
 */
function attachHeadToBody(body, head) {
	//  * @param {string} headBoneName - The name of the head bone from {@link typeof ModelScaleDesc.head}.
	const headBoneName = body.scaleDesc.head;
	if (headBoneName === 'Head') {
		console.error('TODO: Head is not attached correctly to the Miitomo body. Skipping it so you can see what the model looks like anyway.');
		return;
	}

	const headBone = body.model.getObjectByName(headBoneName);
	if (!(headBone instanceof THREE.Bone)) {
		throw new Error('Head bone not found.');
	}
	// Locate the skeleton in the SkinnedMesh, needed to call attach().
	const skinnedMesh = findSkinnedMeshWithBone(body.model, headBoneName);
	if (!skinnedMesh) {
		throw new Error('No skinned mesh with head bone.');
	}
	const skeleton = /** @type {SkeletonWithAttachments} */ (skinnedMesh.skeleton);

	// Set head to body scale ratio.
	// Multiply by 0.1, assuming the body's world scale was normalized to 1.0.
	head.scale.setScalar(0.1 * headToBodyScale);

	// Add the model to the scene, and attach it to the SkeletonWithAttachments.
	headBone.add(head); // This will render it.
	skeleton.attach(head, headBoneName); // This positions it with the scaled bone.
}

// // ---------------------------------------------------------------------
// //  Handlers for Swapping Models
// // ---------------------------------------------------------------------

/**
 * Updates the head and body based on the CharModel,
 * then removes the old ones from the scene.
 * @param {THREE.Group} headModel - The new head model.
 */
function updateCharModel(headModel) {
	// breakFrameCounter = 0; // Use with breakOnCounter
	// Update global state from the new CharModel.
	build = additionalInfo.build;
	height = additionalInfo.height;
	gender = additionalInfo.gender;
	updateBuildHeightGenderUI();

	// Load the new body.
	const newBody = loadBodyModel(gender);

	// Set uniforms on the body, and attach the head to it.
	prepareBodyForCharModel(newBody.model, additionalInfo, build, height);
	attachHeadToBody(newBody, headModel);
	// Attach the shadow too, which should already be in the scene.
	if (currentShadowModel) {
		attachShadowModelToBody(newBody, currentShadowModel);
	}

	// Dispose and remove the old models.
	if (currentBody) {
		scene.remove(currentBody.model);
		disposeModel(currentBody.model);
	}
	if (currentHead) {
		currentHead.removeFromParent(); // Remove from body group.
		disposeModel(currentHead); // Though head is attached, dispose traverses
	}
	if (mixer && currentBody) { // Dispose the mixer.
		mixer.uncacheRoot(currentBody.model);
	}

	// Add the body, which contains the head, to the scene.
	scene.add(newBody.model);

	currentHead = headModel;
	currentBody = newBody;
}

/** @param {BodyModel} newBody - The body model to replace in the scene. */
function reloadBodyModel(newBody) {
	// Prepare the new body model and attach the head.
	prepareBodyForCharModel(newBody.model, additionalInfo, build, height);
	if (currentHead) {
		attachHeadToBody(newBody, currentHead);
	}
	// Dispose and remove the current body model from the scene.
	if (currentBody) {
		disposeModel(currentBody.model);
		// Remove all skeleton attachments.
		currentBody.model.traverse((node) => {
			if (node instanceof THREE.SkinnedMesh) {
				const skeleton = /** @type {SkeletonWithAttachments} */ (node.skeleton);
				if (currentHead && skeleton.detachAll) {
					skeleton.detachAll();
				}
			}
		});
		scene.remove(currentBody.model);
	}
	// Add and set the new body in the scene.
	scene.add(newBody.model);
	currentBody = newBody;
}

/**
 * Without reloading the head model, this will either update
 * body scaling, or swap the body model if the gender changes.
 * @param {number} newBuild - The new build to update with.
 * @param {number} newHeight - The new height to update with.
 * @param {number} newGender - The new gender to replace the body model for.
 */
function updateBuildHeightGender(newBuild, newHeight, newGender) {
	build = newBuild;
	height = newHeight;
	updateBuildHeightGenderUI();

	// Gender changed: reload body, re-attach current head.
	if (newGender !== gender || !currentBody) {
		gender = newGender;
		const newBody = loadBodyModel(gender);
		reloadBodyModel(newBody);
	} else {
		// Otherwise, just re-apply scaling to existing body.
		updateBodyScale(currentBody.model, build, height);
	}
}

// // ---------------------------------------------------------------------
// //  Shadow Model/Texture
// // ---------------------------------------------------------------------

/**
 * Creates a quad mesh for the shadow below the body model.
 * @returns {THREE.Mesh} The shadow mesh.
 */
function createShadowModel() {
	// const geometry = new THREE.PlaneGeometry(7.5); // Not quite right.
	// Vertex data for the shadow_model from MiiTop.bfres.
	const position = new Float32Array([
		-3.75, 0, -3.75,
		3.75, 0, 3.75,
		3.75, 0, -3.75,
		-3.75, 0, 3.75
	]);
	const uv = new Float32Array([
		0, 0,
		2, 2,
		2, 0,
		0, 2
	]);
	const index = new Uint8Array([0, 1, 2, 3, 1, 0]);
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	geometry.setIndex(new THREE.Uint8BufferAttribute(index, 1));

	// The shadow texture, black = alpha, 32x32. Originally a BC4 texture in MiiTop.bfres.
	// It represents a radial gradient originating from the bottom right. SVG approximation:
	/*
	<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" baseProfile="tiny" style="transform:rotate(180deg)" version="1.2"><defs><radialGradient id="a" cx="0" cy="0" r="32" gradientUnits="userSpaceOnUse"><stop offset=".25" stop-color="#fff"/><stop offset="1"/></radialGradient></defs><rect fill="url(#a)" height="32" width="32" x="0" y="0"/></svg>
	*/
	const shadowImageDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAAAAABWESUoAAAACXBIWXMAAA3XAAAN1wFCKJt4AAABJUlEQVQ4y3WTSXLDMAwEgdmo/784B4iUnDg4+IKunoHK7Pp/0N3V33dNEI3/AFEkgO7uL4AliQS/G+wbINCo3wY6Q/DO+GVwEtuWKPAP0FlJYsuidsvX2WtlbcXc8WHAuoZwLG/gMWBd61onZGp2t3b+uh5iDgGBrg1kvQjHkgg+Bq9PwtaUuA1MVvIQcwiBbXCStW5iasjTUnuf5E1MTWAibL+ICYmkbfBMkpVcp4bE2yD5OO6Y+Vpkt6okyXokhxCJVhUlyZYdexNZsQdozVgfjixbQqu4Rzo5udaVRAJUuJdbEydrCLNKRYA8lCVvwlVVKIAAwYeanNkX0GgA2J5JcuL9/h7iqEjJrwfa88ZeKkp8A9XPbOH5r1Z1dVVX9/PTfYAfsQsMgS5LNfoAAAAASUVORK5CYII=';

	// Load texture and set mirrored repeat wrapping.
	const shadowTexture = new THREE.TextureLoader().load(
		shadowImageDataUrl,
		(t) => {
			t.wrapS = THREE.MirroredRepeatWrapping;
			t.wrapT = THREE.MirroredRepeatWrapping;
			t.flipY = false; // Using GX2 coordinate system.
			t.needsUpdate = true;
		}
	);

	// From mt_shadow:
	// diffuse = 0.0, 0.0, 0.0
	// opacity = 0.2980392, 0.2980392, 0.2980392
	// ambient = 0.4, 0.4, 0.4
	// specular = 1.0, 1.0, 1.0
	const material = new THREE.MeshBasicMaterial({
		map: shadowTexture,
		transparent: true,
		depthWrite: false,
		blending: THREE.SubtractiveBlending,
		color: 0x666666 // 0.29804
	});

	return new THREE.Mesh(geometry, material);
}

/**
 * Attaches the shadow below the body model.
 * @param {BodyModel} body - The body model.
 * @param {THREE.Mesh} mesh - The existing shadow model.
 * @throws {Error} Throws if the bone on the body can't be found.
 */
function attachShadowModelToBody(body, mesh) {
	// const mesh = createShadowModel();
	// Anchor to the root.
	const boneName = body.scaleDesc.shadow;
	// I believe the way this is mounted in Wii U Mii Maker, is that "MiiTop.bfres"
	// is like a "wrapper" for the Mii body. shadow_model is in "MiiTopL", the body
	// is "mounted" in the bone "MiiL" but the shadow is high in the hierarchy.
	const shadowBone = body.model.getObjectByName(boneName);
	if (shadowBone && shadowBone instanceof THREE.Object3D) {
		const skinnedMesh = findSkinnedMeshWithBone(body.model, boneName);
		if (!skinnedMesh) {
			throw new Error(`Cannot find shadow bone: ${boneName}`);
		}
		// mesh.rotation.x = THREE.MathUtils.degToRad(-90); // Lay flat XZ

		// Add to scene.
		// shadowBone.add(mesh); // Add to scene.
		// Actually, if this is placed in the body model group, then
		// it will unintentionally be included for material changes.
		scene.add(mesh);
		// This will be a pain to track. detachAll() will control this.
		// Perhaps we should put attachment in the Object3D.
		/** @type {SkeletonWithAttachments} */ (skinnedMesh.skeleton)
			.attach(mesh, boneName, true);
	}
}

// // ---------------------------------------------------------------------
// //  Shader/Material Class Helpers
// // ---------------------------------------------------------------------

/**
 * Applies a new material class to the mesh and applying existing
 * parameters from the old material and userData to an FFL-compatible material.
 * Also see `onShaderMaterialChange` from FFL.js/examples/demo-basic.js.
 * @param {THREE.Mesh} mesh - The mesh to apply the material to.
 * @param {function(new: import('three').Material, ...*): import('three').Material} newMatClass -
 * The new material class to apply.
 * @param {SampleShaderMaterialColorInfo|null} colorInfo - Specific object needed for {@link SampleShaderMaterial}.
 */
function applyMaterialClassToMesh(mesh, newMatClass, colorInfo) {
	/** Whether the new material supports FFL swizzling. */
	const forFFLMaterial = 'modulateMode' in newMatClass.prototype;
	// Recreate material with same parameters but using the new shader class.
	const oldMat = /** @type {THREE.MeshBasicMaterial} */ (mesh.material);
	/** Get modulateMode/Type */
	const userData = mesh.geometry.userData;

	/** Do not include the parameters if forFFLMaterial is false. */
	const modulateModeType = forFFLMaterial
		? { // modulateMode/Type will be used from the userData or old material.
			modulateMode: 'modulateMode' in oldMat ? oldMat.modulateMode : userData.modulateMode ?? 0,
			// This setter will set side too:
			modulateType: 'modulateType' in oldMat ? oldMat.modulateType : userData.modulateType ?? 0
		}
		: {};

	/**
	 * Parameters for the shader material. Using SampleShaderMaterialParameters
	 * as a lowest common denominator, but others can also be used.
	 * @type {import('three').MeshBasicMaterialParameters
	 * & import('./FFL.js/SampleShaderMaterial.js').SampleShaderMaterialParameters}
	 */
	const params = {
		// _side = original side from LUTShaderMaterial, must be set first
		side: ('_side' in oldMat) ? /** @type {THREE.Side} */ (oldMat._side) : oldMat.side,
		...modulateModeType,
		color: oldMat.color, // should be after modulateType
		transparent: Boolean(oldMat.transparent || oldMat.alphaTest)
	};
	if (oldMat.map) {
		params.map = oldMat.map;
	}

	if ('modulateType' in userData) {
		params.modulateMode = userData.modulateMode ?? 0;
		params.modulateType = userData.modulateType;
	}
	if (colorInfo && 'colorInfo' in newMatClass.prototype) {
		// console.debug('got colorinfo on', mesh)
		params.colorInfo = colorInfo;
	}

	mesh.material = new newMatClass(params);

	// HACK: For SampleShaderMaterial with glTF head models, let's not
	// set drawType uniform to faceline. TODO: Specifically only
	// needs to be done if it's not from FFL.js, and, if faceline
	// color is not transparent (will also result in beards having wrong color)
	if (mesh.material instanceof SampleShaderMaterial &&
		userData.modulateType === 0) {
		// TODO: This will also break if you request: /miis/image.glb?shaderType=switch&data=
		// 0804400308040402020C0308060406020A0000020000000804100A01001E4004000214031304170D06020A040109
		// (Should we automatically include &shaderType=switch when SampleShaderMaterial is detected?)
		mesh.material.uniforms.drawType.value = 0;
	}
}

/**
 * Calls {@link applyMaterialClassToMesh} on a group of multiple
 * meshes (head or body model), using the name of the material.
 * @param {THREE.Object3D} group - The group to apply the material to.
 * @param {string} materialClassName - The name of the material class registered in {@link materials}.
 * @param {SampleShaderMaterialColorInfo|null} colorInfo - Needed for SampleShaderMaterial.
 * @throws {Error} Throws if the material does not exist in {@link materials}
 */
function applyMaterialToGroup(group, materialClassName, colorInfo) {
	const matClass = materials[materialClassName];
	if (!matClass) {
		throw new Error(`Unknown shader: ${materialClassName}`);
	}

	group.traverse((node) => {
		if (node instanceof THREE.Mesh) {
			applyMaterialClassToMesh(node, matClass, colorInfo);
		}
	});
}

/**
 * Disposes geometry, material and map, and skeleton.
 * @param {THREE.Object3D} model - The group of meshes or SkinnedMeshes to dispose.
 */
function disposeModel(model) {
	model.traverse((node) => {
		if (node instanceof THREE.Mesh) {
			node.geometry.dispose();
			if (node.material instanceof THREE.Material) {
				const map = /** @type {THREE.MeshBasicMaterial} */ (node.material).map;
				if (map) {
					map.dispose();
				}
				node.material.dispose();
			}
		}
		// Additionally dispose skeleton if it is a SkinnedMesh.
		if (node instanceof THREE.SkinnedMesh && node.skeleton) {
			node.skeleton.dispose();
		}
	});
}

// // ---------------------------------------------------------------------
// //  UI Setup and Updates
// // ---------------------------------------------------------------------

// DOM references.
const modelForm = /** @type {HTMLFormElement} */ (document.getElementById('modelForm'));
const shaderSelector = /** @type {HTMLInputElement} */ (document.getElementById('shaderSelector'));
const modelUrl = /** @type {HTMLInputElement} */ (document.getElementById('modelUrl'));
const loadButton = /** @type {HTMLButtonElement} */ (document.getElementById('loadModelButton'));
const buildSlider = /** @type {HTMLInputElement} */ (document.getElementById('buildSlider'));
const heightSlider = /** @type {HTMLInputElement} */ (document.getElementById('heightSlider'));
const buildValue = /** @type {HTMLSpanElement} */ (document.getElementById('buildValue'));
const heightValue = /** @type {HTMLSpanElement} */ (document.getElementById('heightValue'));
const genderSelect = /** @type {HTMLSelectElement} */ (document.getElementById('genderSelect'));
const pauseButton = /** @type {HTMLButtonElement} */ (document.getElementById('pauseButton'));
const resumeButton = /** @type {HTMLButtonElement} */ (document.getElementById('resumeButton'));
const hideUiButton = /** @type {HTMLButtonElement} */ (document.getElementById('hideUiButton'));
const showUiButton = /** @type {HTMLButtonElement} */ (document.getElementById('showUiButton'));
const rotationSpeedSlider = /** @type {HTMLInputElement} */ (document.getElementById('rotationSpeed'));
const ui = /** @type {HTMLDivElement} */ (document.getElementById('ui'));

/** Updates UI sliders and selectors from current state. */
function updateBuildHeightGenderUI() {
	buildSlider.value = String(build);
	buildValue.innerText = String(build);
	heightSlider.value = String(height);
	heightValue.innerText = String(height);
	genderSelect.value = String(gender);
}

/** Sets up UI event listeners. */
function setupUI() {
	modelForm.addEventListener('submit', (/** @type {SubmitEvent} */ e) => {
		// On updating new model with URL.
		e.preventDefault();
		loadButton.disabled = true;
		loadCharModelFromGLTF(modelUrl.value)
			.then(model => updateCharModel(model))
			// Disable the loading button while loading, re-enable when done.
			.finally(() => loadButton.disabled = false);
	});

	// On changing the shader.
	shaderSelector.addEventListener('change', () => {
		activeMaterialClassName = shaderSelector.value;
		// If the head is attached to the body in the scene graph, then we'll only
		// want to apply the material to it since it'll propagate to the head.
		if (currentBody) {
			applyMaterialToGroup(currentBody.model,
				activeMaterialClassName, additionalInfo.colorInfo);
		} else if (currentHead) {
			applyMaterialToGroup(currentHead, activeMaterialClassName, additionalInfo.colorInfo);
		}
	});

	// Physique and gender (body model select).
	buildSlider.addEventListener('input', () =>
		updateBuildHeightGender(parseInt(buildSlider.value, 10), height, gender));
	heightSlider.addEventListener('input', () =>
		updateBuildHeightGender(build, parseInt(heightSlider.value, 10), gender));
	genderSelect.addEventListener('change', () =>
		updateBuildHeightGender(build, height, parseInt(genderSelect.value, 10)));

	// Rotation controls.
	pauseButton.addEventListener('click', () => {
		isRotating = false;
		controls.autoRotate = false;
		pauseButton.style.display = 'none';
		resumeButton.style.display = '';
	});
	resumeButton.addEventListener('click', () => {
		isRotating = true;
		controls.autoRotate = true;
		pauseButton.style.display = '';
		resumeButton.style.display = 'none';
	});
	rotationSpeedSlider.addEventListener('input', () => {
		rotationSpeed = parseFloat(rotationSpeedSlider.value);
		controls.autoRotateSpeed = rotationSpeed;
	});

	// Controls for hiding/showing UI.
	hideUiButton.addEventListener('click', () => {
		ui.style.display = 'none';
		showUiButton.style.display = '';
	});
	showUiButton.addEventListener('click', () => {
		ui.style.display = '';
		showUiButton.style.display = 'none';
	});
}

/*
let breakFrameCounter = null;
function breakOnCounter() {
	if (breakFrameCounter === null) {
		return;
	}

	breakFrameCounter++;
	if (breakFrameCounter < 15) debugger;
}
*/

/** The result of {@link THREE.Clock.getDelta} stored separately from the mixer. */
let animClockDelta = 0;

/** Animation loop. */
function animate() {
	requestAnimationFrame(animate);

	// breakOnFrameCounter();
	if (mixer) {
		// mixer.update(clock.getDelta());
		// Let's store the delta in this global, so that when
		// the mixer or animation changes, the time persists.
		animClockDelta += clock.getDelta();
		mixer.setTime(animClockDelta);
	}
	controls.update();
	renderer.render(scene, camera);
}

/** Main startup. */
function main() {
	initRendererAndScene();

	// Create shadow model.
	currentShadowModel = createShadowModel();

	// Try to load body models and CharModel glTF at once.
	Promise.all([preloadBodyTemplates(),
		loadCharModelFromGLTF(modelUrl.value)]).then((value) => {
		updateCharModel(value[1]);
	});

	setupUI(); // Initial load with default URL.

	requestAnimationFrame(animate); // Start animation loop.
}
document.addEventListener('DOMContentLoaded', main);
