/**
 * Outdoor Scene Preview - 3D visualization of environment palettes
 * Creates a stylized outdoor scene with elements mapped to palette slots
 */

import { EnvironmentPalette, SlotId } from '../Domain/EnvironmentPalette.js';

/**
 * Outdoor Scene Preview component
 * Renders a low-poly outdoor environment scene linked to an EnvironmentPalette
 */
export class OutdoorScenePreview {
    private scene: any;
    private camera: any;
    private renderer: any;
    private controls: any;
    private container: HTMLElement;
    private animationFrameId: number | null = null;
    private THREE: any;
    private OrbitControls: any;
    private GLTFExporter: any;
    private palette: EnvironmentPalette;
    
    // Scene objects mapped to palette slots
    private materials: Map<SlotId, any> = new Map();
    private meshGroups: Map<SlotId, any[]> = new Map();

    constructor(containerId: string, palette: EnvironmentPalette) {
        this.container = document.getElementById(containerId) as HTMLElement;
        if (!this.container) {
            throw new Error(`Container element with id "${containerId}" not found`);
        }

        this.palette = palette;

        this.initializeThreeJS().then(() => {
            this.setupScene();
            this.createEnvironment();
            this.setupPaletteCallbacks();
            this.startRenderLoop();
        }).catch((error) => {
            console.error('Failed to initialize Outdoor Scene Preview:', error);
        });
    }

    /**
     * Dynamically imports Three.js, OrbitControls, and GLTFExporter
     */
    private async initializeThreeJS(): Promise<void> {
        try {
            this.THREE = await import('three' as any);
            const orbitControlsModule = await import('three/addons/controls/OrbitControls.js' as any);
            this.OrbitControls = orbitControlsModule.OrbitControls;
            const gltfExporterModule = await import('three/addons/exporters/GLTFExporter.js' as any);
            this.GLTFExporter = gltfExporterModule.GLTFExporter;
        } catch (error) {
            throw new Error(`Failed to load Three.js: ${error}`);
        }
    }

    /**
     * Sets up the Three.js scene, camera, renderer, and lighting
     */
    private setupScene(): void {
        // Scene
        this.scene = new this.THREE.Scene();
        
        // Set initial sky color
        const skyColor = this.palette.getColor('sky');
        this.scene.background = new this.THREE.Color(skyColor);

        // Add fog for atmosphere
        this.scene.fog = new this.THREE.Fog(skyColor, 20, 60);

        // Camera - positioned to view the outdoor scene
        this.camera = new this.THREE.PerspectiveCamera(
            50,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(12, 8, 16);
        this.camera.lookAt(0, 2, 0);

        // Renderer
        this.renderer = new this.THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = this.THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Lighting - outdoor style
        // Ambient light (sky contribution)
        const ambientLight = new this.THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Hemisphere light (sky/ground color)
        const hemiLight = new this.THREE.HemisphereLight(
            new this.THREE.Color(skyColor),
            new this.THREE.Color(this.palette.getColor('grass')),
            0.3
        );
        this.scene.add(hemiLight);

        // Sun light
        const sunLight = new this.THREE.DirectionalLight(0xfffaf0, 1.0);
        sunLight.position.set(15, 20, 10);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 60;
        sunLight.shadow.camera.left = -25;
        sunLight.shadow.camera.right = 25;
        sunLight.shadow.camera.top = 25;
        sunLight.shadow.camera.bottom = -25;
        this.scene.add(sunLight);

        // Fill light from opposite side
        const fillLight = new this.THREE.DirectionalLight(0xaaccff, 0.2);
        fillLight.position.set(-10, 5, -10);
        this.scene.add(fillLight);

        // Controls
        this.controls = new this.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        this.controls.target.set(0, 2, 0);
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent going below ground
        this.controls.minDistance = 5;
        this.controls.maxDistance = 40;
        this.controls.update();

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    /**
     * Creates a material for a specific slot
     */
    private createMaterial(slotId: SlotId): any {
        const color = this.palette.getColor(slotId);
        const material = new this.THREE.MeshStandardMaterial({
            color: new this.THREE.Color(color),
            roughness: 0.8,
            metalness: 0.0,
            flatShading: true // Low-poly look
        });
        this.materials.set(slotId, material);
        return material;
    }

    /**
     * Creates all environment elements
     */
    private createEnvironment(): void {
        this.createGround();
        this.createWater();
        this.createTrees();
        this.createRocks();
        this.createDirtPatches();
        this.createAccentObjects();
    }

    /**
     * Creates the grass ground plane
     */
    private createGround(): void {
        const material = this.createMaterial('grass');
        
        // Main ground - slightly uneven for visual interest
        const groundGeometry = new this.THREE.PlaneGeometry(50, 50, 10, 10);
        
        // Add slight height variation
        const positions = groundGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = Math.sin(x * 0.3) * Math.cos(y * 0.3) * 0.2;
            positions.setZ(i, z);
        }
        groundGeometry.computeVertexNormals();

        const ground = new this.THREE.Mesh(groundGeometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);

        this.meshGroups.set('grass', [ground]);
    }

    /**
     * Creates a water pond
     */
    private createWater(): void {
        const material = this.createMaterial('water');
        material.roughness = 0.1;
        material.metalness = 0.3;
        material.transparent = true;
        material.opacity = 0.85;

        // Pond shape - circular with slight wave displacement
        const waterGeometry = new this.THREE.CircleGeometry(4, 16);
        const water = new this.THREE.Mesh(waterGeometry, material);
        water.rotation.x = -Math.PI / 2;
        water.position.set(-6, 0.05, 4);
        water.receiveShadow = true;
        this.scene.add(water);

        this.meshGroups.set('water', [water]);
    }

    /**
     * Creates stylized low-poly trees
     */
    private createTrees(): void {
        const foliageMaterial = this.createMaterial('foliage');
        const barkMaterial = this.createMaterial('bark');

        const trees: any[] = [];

        // Tree positions
        const treePositions = [
            { x: 5, z: -5, scale: 1.0 },
            { x: 8, z: -3, scale: 0.8 },
            { x: -8, z: -6, scale: 1.2 },
            { x: -4, z: -8, scale: 0.9 },
            { x: 3, z: 7, scale: 1.1 },
            { x: -10, z: 2, scale: 0.7 },
            { x: 10, z: 5, scale: 0.85 }
        ];

        for (const pos of treePositions) {
            const tree = this.createTree(foliageMaterial, barkMaterial, pos.scale);
            tree.position.set(pos.x, 0, pos.z);
            this.scene.add(tree);
            trees.push(tree);
        }

        this.meshGroups.set('foliage', trees);
        // Bark uses same tree meshes, so we track bark material separately
    }

    /**
     * Creates a single stylized tree
     */
    private createTree(foliageMaterial: any, barkMaterial: any, scale: number): any {
        const tree = new this.THREE.Group();

        // Trunk - tapered cylinder
        const trunkGeometry = new this.THREE.CylinderGeometry(0.15 * scale, 0.3 * scale, 2 * scale, 6);
        const trunk = new this.THREE.Mesh(trunkGeometry, barkMaterial);
        trunk.position.y = scale;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);

        // Foliage - stacked cones for low-poly pine tree look
        const foliageHeights = [2.5, 3.2, 3.8];
        const foliageRadii = [1.8, 1.4, 0.9];

        for (let i = 0; i < 3; i++) {
            const coneGeometry = new this.THREE.ConeGeometry(
                foliageRadii[i] * scale,
                1.5 * scale,
                6
            );
            const cone = new this.THREE.Mesh(coneGeometry, foliageMaterial);
            cone.position.y = foliageHeights[i] * scale;
            cone.castShadow = true;
            cone.receiveShadow = true;
            tree.add(cone);
        }

        return tree;
    }

    /**
     * Creates rock formations
     */
    private createRocks(): void {
        const material = this.createMaterial('rock');
        const rocks: any[] = [];

        // Rock positions and sizes
        const rockConfigs = [
            { x: 2, z: 3, scale: 1.5 },
            { x: 3, z: 2.5, scale: 0.8 },
            { x: -2, z: -3, scale: 1.2 },
            { x: 7, z: 0, scale: 1.0 },
            { x: -6, z: 7, scale: 0.9 }
        ];

        for (const config of rockConfigs) {
            const rock = this.createRock(material, config.scale);
            rock.position.set(config.x, 0, config.z);
            rock.rotation.y = Math.random() * Math.PI * 2;
            this.scene.add(rock);
            rocks.push(rock);
        }

        this.meshGroups.set('rock', rocks);
    }

    /**
     * Creates a single stylized rock
     */
    private createRock(material: any, scale: number): any {
        // Use dodecahedron for organic rock shape
        const geometry = new this.THREE.DodecahedronGeometry(0.6 * scale, 0);
        
        // Deform vertices for a more natural look
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            
            const noise = 0.8 + Math.random() * 0.4;
            positions.setXYZ(i, x * noise, Math.max(0.1, y * noise), z * noise);
        }
        geometry.computeVertexNormals();

        const rock = new this.THREE.Mesh(geometry, material);
        rock.position.y = 0.3 * scale;
        rock.castShadow = true;
        rock.receiveShadow = true;

        return rock;
    }

    /**
     * Creates dirt path/patches
     */
    private createDirtPatches(): void {
        const material = this.createMaterial('dirt');
        const patches: any[] = [];

        // Create a winding path
        const pathPoints = [
            { x: 0, z: 10 },
            { x: 1, z: 6 },
            { x: 0, z: 2 },
            { x: -1, z: -2 },
            { x: 0, z: -6 }
        ];

        for (const point of pathPoints) {
            const patchGeometry = new this.THREE.CircleGeometry(1.2 + Math.random() * 0.5, 8);
            const patch = new this.THREE.Mesh(patchGeometry, material);
            patch.rotation.x = -Math.PI / 2;
            patch.position.set(point.x + (Math.random() - 0.5), 0.02, point.z);
            patch.receiveShadow = true;
            this.scene.add(patch);
            patches.push(patch);
        }

        this.meshGroups.set('dirt', patches);
    }

    /**
     * Creates accent objects (flowers, crystals, or glowing items)
     */
    private createAccentObjects(): void {
        const material = this.createMaterial('accent');
        material.emissive = new this.THREE.Color(this.palette.getColor('accent'));
        material.emissiveIntensity = 0.3;

        const accents: any[] = [];

        // Create flower-like accent objects scattered around
        const accentPositions = [
            { x: -3, z: 1 },
            { x: 4, z: 5 },
            { x: -1, z: -4 },
            { x: 6, z: -2 },
            { x: -5, z: -2 }
        ];

        for (const pos of accentPositions) {
            const accent = this.createAccentFlower(material);
            accent.position.set(pos.x, 0, pos.z);
            this.scene.add(accent);
            accents.push(accent);
        }

        this.meshGroups.set('accent', accents);
    }

    /**
     * Creates a stylized accent flower/crystal
     */
    private createAccentFlower(material: any): any {
        const group = new this.THREE.Group();

        // Stem
        const stemGeometry = new this.THREE.CylinderGeometry(0.03, 0.04, 0.5, 4);
        const stemMaterial = new this.THREE.MeshStandardMaterial({
            color: 0x2d5016,
            roughness: 0.8
        });
        const stem = new this.THREE.Mesh(stemGeometry, stemMaterial);
        stem.position.y = 0.25;
        group.add(stem);

        // Flower/crystal head - octahedron for gem-like look
        const headGeometry = new this.THREE.OctahedronGeometry(0.15, 0);
        const head = new this.THREE.Mesh(headGeometry, material);
        head.position.y = 0.6;
        head.castShadow = true;
        group.add(head);

        return group;
    }

    /**
     * Sets up callbacks to update materials when palette changes
     */
    private setupPaletteCallbacks(): void {
        this.palette.onChange(() => {
            this.updateAllMaterials();
        });
    }

    /**
     * Updates all materials to match current palette
     */
    private updateAllMaterials(): void {
        // Update sky/background
        const skyColor = this.palette.getColor('sky');
        this.scene.background = new this.THREE.Color(skyColor);
        this.scene.fog.color = new this.THREE.Color(skyColor);

        // Update all slot materials
        const slotIds: SlotId[] = ['grass', 'water', 'foliage', 'bark', 'rock', 'dirt', 'accent'];
        
        for (const slotId of slotIds) {
            const material = this.materials.get(slotId);
            if (material) {
                const newColor = this.palette.getColor(slotId);
                material.color.set(newColor);
                
                // Update emissive for accent
                if (slotId === 'accent') {
                    material.emissive.set(newColor);
                }
                
                material.needsUpdate = true;
            }
        }
    }

    /**
     * Handles window resize
     */
    private handleResize(): void {
        if (!this.camera || !this.renderer || !this.container) {
            return;
        }

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Starts the render loop
     */
    private startRenderLoop(): void {
        const animate = () => {
            this.animationFrameId = requestAnimationFrame(animate);
            
            if (this.controls) {
                this.controls.update();
            }
            
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        };
        animate();
    }

    /**
     * Resets camera to default position
     */
    resetCamera(): void {
        if (this.camera && this.controls) {
            this.camera.position.set(12, 8, 16);
            this.controls.target.set(0, 2, 0);
            this.controls.update();
        }
    }

    /**
     * Exports the scene meshes to GLTF/GLB format for use in game engines
     * Excludes lights and sky - only exports geometry with materials
     */
    async exportToGLTF(binary: boolean = true): Promise<void> {
        if (!this.GLTFExporter) {
            console.error('GLTFExporter not loaded');
            return;
        }

        // Create a new group with only the mesh objects
        const exportGroup = new this.THREE.Group();
        exportGroup.name = 'EnvironmentPalette_Scene';

        // Track unique mesh index for naming
        let meshIndex = 0;

        // Naming map for slot IDs to friendly names
        const slotNames: Record<string, string> = {
            'grass': 'Ground',
            'water': 'Water',
            'rock': 'Rock',
            'dirt': 'DirtPath',
            'bark': 'TreeTrunk',
            'foliage': 'TreeFoliage',
            'accent': 'AccentFlower'
        };

        // Clone and organize meshes by slot
        this.meshGroups.forEach((meshes, slotId) => {
            const slotGroup = new this.THREE.Group();
            slotGroup.name = slotNames[slotId] || slotId;

            meshes.forEach((mesh, idx) => {
                // Clone the mesh to avoid modifying the original
                const clonedMesh = mesh.clone();
                
                // Handle groups (like trees with trunk + foliage)
                if (clonedMesh.isGroup) {
                    clonedMesh.name = `${slotGroup.name}_${idx + 1}`;
                    clonedMesh.children.forEach((child: any, childIdx: number) => {
                        child.name = `${clonedMesh.name}_part${childIdx + 1}`;
                    });
                } else {
                    clonedMesh.name = `${slotGroup.name}_${idx + 1}`;
                }

                slotGroup.add(clonedMesh);
                meshIndex++;
            });

            if (slotGroup.children.length > 0) {
                exportGroup.add(slotGroup);
            }
        });

        // Export using GLTFExporter
        const exporter = new this.GLTFExporter();
        
        const options = {
            binary: binary,
            onlyVisible: true,
            includeCustomExtensions: false
        };

        exporter.parse(
            exportGroup,
            (result: any) => {
                // Download the file
                const extension = binary ? 'glb' : 'gltf';
                const mimeType = binary ? 'application/octet-stream' : 'application/json';
                
                let blob: Blob;
                if (binary) {
                    blob = new Blob([result], { type: mimeType });
                } else {
                    const output = JSON.stringify(result, null, 2);
                    blob = new Blob([output], { type: mimeType });
                }

                // Create download link
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `environment_scene.${extension}`;
                link.click();
                
                // Cleanup
                URL.revokeObjectURL(link.href);
                
                console.log(`Scene exported as ${extension.toUpperCase()} (${meshIndex} objects)`);
            },
            (error: any) => {
                console.error('Error exporting scene:', error);
            },
            options
        );
    }

    /**
     * Cleanup method
     */
    dispose(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.materials.forEach(material => {
            if (material) material.dispose();
        });

        this.meshGroups.forEach(meshes => {
            meshes.forEach(mesh => {
                if (mesh.geometry) mesh.geometry.dispose();
                // Handle groups
                if (mesh.children) {
                    mesh.children.forEach((child: any) => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) child.material.dispose();
                    });
                }
            });
        });

        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}
