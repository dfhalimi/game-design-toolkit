/**
 * 3D Level Preview
 * Three.js-based 3D preview of the level with lighting and orbit controls
 */

import { Level } from '../Domain/Level.js';
import {
    AnyLevelElement,
    isWallElement,
    isFloorElement,
    isSpawnElement,
    WallElement,
    FloorElement,
    SpawnElement
} from '../Domain/LevelElement.js';

/**
 * 3D Level Preview class
 */
export class LevelPreview3D {
    private container: HTMLElement;
    private level: Level;

    // Three.js objects (dynamically loaded)
    private THREE: any;
    private OrbitControls: any;
    private scene: any;
    private camera: any;
    private renderer: any;
    private controls: any;

    // Scene objects
    private levelGroup: any;
    private gridHelper: any;
    private animationFrameId: number | null = null;

    // Materials (reused for performance)
    private wallMaterial: any;
    private floorMaterial: any;
    private spawnMaterials: Map<string, any> = new Map();

    // Configuration
    private readonly WALL_COLOR = 0x718096;
    private readonly FLOOR_COLOR = 0xa0aec0;
    private readonly SPAWN_PLAYER_COLOR = 0x48bb78;
    private readonly SPAWN_ENEMY_COLOR = 0xf56565;
    private readonly SPAWN_ITEM_COLOR = 0xecc94b;
    private readonly GROUND_COLOR = 0xe2e8f0;
    private readonly SKY_COLOR = 0xf0f4f8;

    constructor(containerId: string, level: Level) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container element with id "${containerId}" not found`);
        }

        this.container = container;
        this.level = level;

        this.initialize();
    }

    /**
     * Initializes Three.js and sets up the scene
     */
    private async initialize(): Promise<void> {
        try {
            await this.loadThreeJS();
            this.setupScene();
            this.setupLighting();
            this.setupControls();
            this.createMaterials();
            this.rebuildLevel();
            this.startRenderLoop();

            // Listen for level changes
            this.level.onChange(() => this.rebuildLevel());

            // Handle window resize
            window.addEventListener('resize', () => this.handleResize());
        } catch (error) {
            console.error('Failed to initialize 3D preview:', error);
        }
    }

    /**
     * Dynamically loads Three.js and OrbitControls
     */
    private async loadThreeJS(): Promise<void> {
        this.THREE = await import('three' as any);
        const orbitControlsModule = await import('three/addons/controls/OrbitControls.js' as any);
        this.OrbitControls = orbitControlsModule.OrbitControls;
    }

    /**
     * Sets up the Three.js scene
     */
    private setupScene(): void {
        // Scene
        this.scene = new this.THREE.Scene();
        this.scene.background = new this.THREE.Color(this.SKY_COLOR);

        // Camera
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new this.THREE.PerspectiveCamera(60, aspect, 0.1, 1000);

        // Position camera to see the whole level
        const gridSize = this.level.getGridSize();
        const maxDim = Math.max(gridSize.width, gridSize.height);
        this.camera.position.set(maxDim * 0.8, maxDim * 0.6, maxDim * 0.8);
        this.camera.lookAt(gridSize.width / 2, 0, gridSize.height / 2);

        // Renderer
        this.renderer = new this.THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = this.THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Level group (for easy clearing)
        this.levelGroup = new this.THREE.Group();
        this.scene.add(this.levelGroup);

        // Grid helper
        this.createGridHelper();
    }

    /**
     * Creates the grid helper
     */
    private createGridHelper(): void {
        const gridSize = this.level.getGridSize();
        const size = Math.max(gridSize.width, gridSize.height);

        // Create grid helper
        this.gridHelper = new this.THREE.GridHelper(
            size,
            size,
            0xcccccc,
            0xe0e0e0
        );
        this.gridHelper.position.set(gridSize.width / 2, 0, gridSize.height / 2);
        this.scene.add(this.gridHelper);

        // Create ground plane
        const groundGeometry = new this.THREE.PlaneGeometry(size * 2, size * 2);
        const groundMaterial = new this.THREE.MeshStandardMaterial({
            color: this.GROUND_COLOR,
            roughness: 0.9,
            metalness: 0.0
        });
        const ground = new this.THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(gridSize.width / 2, -0.01, gridSize.height / 2);
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    /**
     * Sets up scene lighting
     */
    private setupLighting(): void {
        // Ambient light (soft fill)
        const ambientLight = new this.THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Hemisphere light (sky/ground color variation)
        const hemisphereLight = new this.THREE.HemisphereLight(
            0x87ceeb, // Sky color
            0x8b7355, // Ground color
            0.3
        );
        this.scene.add(hemisphereLight);

        // Main directional light (sun)
        const gridSize = this.level.getGridSize();
        const dirLight = new this.THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(
            gridSize.width + 10,
            15,
            gridSize.height + 10
        );
        dirLight.castShadow = true;

        // Shadow configuration
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 100;

        const shadowSize = Math.max(gridSize.width, gridSize.height) * 1.5;
        dirLight.shadow.camera.left = -shadowSize;
        dirLight.shadow.camera.right = shadowSize;
        dirLight.shadow.camera.top = shadowSize;
        dirLight.shadow.camera.bottom = -shadowSize;

        this.scene.add(dirLight);

        // Fill light (softer, from opposite side)
        const fillLight = new this.THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-10, 10, -10);
        this.scene.add(fillLight);
    }

    /**
     * Sets up orbit controls
     */
    private setupControls(): void {
        this.controls = new this.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 200;

        // Set initial target to center of level
        const gridSize = this.level.getGridSize();
        this.controls.target.set(gridSize.width / 2, 1, gridSize.height / 2);
        this.controls.update();
    }

    /**
     * Creates reusable materials
     */
    private createMaterials(): void {
        // Wall material
        this.wallMaterial = new this.THREE.MeshStandardMaterial({
            color: this.WALL_COLOR,
            roughness: 0.7,
            metalness: 0.1
        });

        // Floor material
        this.floorMaterial = new this.THREE.MeshStandardMaterial({
            color: this.FLOOR_COLOR,
            roughness: 0.8,
            metalness: 0.0
        });

        // Spawn materials
        this.spawnMaterials.set('player', new this.THREE.MeshStandardMaterial({
            color: this.SPAWN_PLAYER_COLOR,
            roughness: 0.5,
            metalness: 0.2
        }));

        this.spawnMaterials.set('enemy', new this.THREE.MeshStandardMaterial({
            color: this.SPAWN_ENEMY_COLOR,
            roughness: 0.5,
            metalness: 0.2
        }));

        this.spawnMaterials.set('item', new this.THREE.MeshStandardMaterial({
            color: this.SPAWN_ITEM_COLOR,
            roughness: 0.5,
            metalness: 0.3
        }));
    }

    /**
     * Rebuilds the entire level geometry
     */
    rebuildLevel(): void {
        if (!this.levelGroup) return;

        // Clear existing level geometry
        while (this.levelGroup.children.length > 0) {
            const child = this.levelGroup.children[0];
            this.levelGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        // Create geometry for all elements
        const elements = this.level.getAllElements();

        elements.forEach(element => {
            if (isWallElement(element)) {
                this.createWallMesh(element);
            } else if (isFloorElement(element)) {
                this.createFloorMesh(element);
            } else if (isSpawnElement(element)) {
                this.createSpawnMesh(element);
            }
        });
    }

    /**
     * Creates a 3D mesh for a wall element
     */
    private createWallMesh(element: WallElement): void {
        const geometry = new this.THREE.BoxGeometry(
            element.width,
            element.wallHeight,
            element.depth
        );

        const mesh = new this.THREE.Mesh(geometry, this.wallMaterial);
        
        // Position: center of the wall
        mesh.position.set(
            element.gridX + element.width / 2,
            element.elevation + element.wallHeight / 2,
            element.gridY + element.depth / 2
        );

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.elementId = element.id;

        this.levelGroup.add(mesh);
    }

    /**
     * Creates a 3D mesh for a floor element
     */
    private createFloorMesh(element: FloorElement): void {
        const geometry = new this.THREE.BoxGeometry(
            element.width,
            element.thickness,
            element.depth
        );

        const mesh = new this.THREE.Mesh(geometry, this.floorMaterial);

        // Position: center of the floor
        mesh.position.set(
            element.gridX + element.width / 2,
            element.elevation + element.thickness / 2,
            element.gridY + element.depth / 2
        );

        mesh.receiveShadow = true;
        mesh.userData.elementId = element.id;

        this.levelGroup.add(mesh);
    }

    /**
     * Creates a 3D mesh for a spawn element
     */
    private createSpawnMesh(element: SpawnElement): void {
        // Use a cylinder for spawn markers
        const geometry = new this.THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
        const material = this.spawnMaterials.get(element.spawnType) || this.spawnMaterials.get('player');

        const mesh = new this.THREE.Mesh(geometry, material);

        // Position at center of grid cell
        mesh.position.set(
            element.gridX + 0.5,
            element.elevation + 0.05,
            element.gridY + 0.5
        );

        mesh.castShadow = true;
        mesh.userData.elementId = element.id;

        this.levelGroup.add(mesh);

        // Add a vertical indicator
        const poleGeometry = new this.THREE.CylinderGeometry(0.05, 0.05, 1.8, 8);
        const pole = new this.THREE.Mesh(poleGeometry, material);
        pole.position.set(
            element.gridX + 0.5,
            element.elevation + 0.9,
            element.gridY + 0.5
        );
        pole.castShadow = true;

        this.levelGroup.add(pole);
    }

    /**
     * Handles window resize
     */
    private handleResize(): void {
        if (!this.camera || !this.renderer) return;

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
     * Gets the Three.js scene (for export)
     */
    getScene(): any {
        return this.scene;
    }

    /**
     * Gets the level group containing all level geometry
     */
    getLevelGroup(): any {
        return this.levelGroup;
    }

    /**
     * Gets the Three.js module reference
     */
    getThree(): any {
        return this.THREE;
    }

    /**
     * Resets the camera to default position
     */
    resetCamera(): void {
        const gridSize = this.level.getGridSize();
        const maxDim = Math.max(gridSize.width, gridSize.height);

        this.camera.position.set(maxDim * 0.8, maxDim * 0.6, maxDim * 0.8);
        this.controls.target.set(gridSize.width / 2, 1, gridSize.height / 2);
        this.controls.update();
    }

    /**
     * Disposes of all Three.js resources
     */
    dispose(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        // Dispose materials
        this.wallMaterial?.dispose();
        this.floorMaterial?.dispose();
        this.spawnMaterials.forEach(mat => mat.dispose());

        // Dispose geometries in level group
        if (this.levelGroup) {
            this.levelGroup.traverse((child: any) => {
                if (child.geometry) child.geometry.dispose();
            });
        }

        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}
