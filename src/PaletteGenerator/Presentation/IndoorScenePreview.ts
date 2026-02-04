/**
 * Indoor Scene Preview - 3D visualization of interior palettes
 * Creates a stylized room scene with elements mapped to palette slots
 */

import { InteriorPalette, InteriorSlotId } from '../Domain/InteriorPalette.js';

/**
 * Indoor Scene Preview component
 * Renders a low-poly interior room scene linked to an InteriorPalette
 */
export class IndoorScenePreview {
    private scene: any;
    private camera: any;
    private renderer: any;
    private controls: any;
    private container: HTMLElement;
    private animationFrameId: number | null = null;
    private THREE: any;
    private OrbitControls: any;
    private GLTFExporter: any;
    private palette: InteriorPalette;
    
    // Scene objects mapped to palette slots
    private materials: Map<InteriorSlotId, any> = new Map();
    private meshGroups: Map<InteriorSlotId, any[]> = new Map();

    // Room dimensions
    private readonly ROOM_WIDTH = 8;
    private readonly ROOM_DEPTH = 6;
    private readonly ROOM_HEIGHT = 3;

    constructor(containerId: string, palette: InteriorPalette) {
        this.container = document.getElementById(containerId) as HTMLElement;
        if (!this.container) {
            throw new Error(`Container element with id "${containerId}" not found`);
        }

        this.palette = palette;

        this.initializeThreeJS().then(() => {
            this.setupScene();
            this.createRoom();
            this.setupPaletteCallbacks();
            this.startRenderLoop();
        }).catch((error) => {
            console.error('Failed to initialize Indoor Scene Preview:', error);
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
        // Scene with neutral background
        this.scene = new this.THREE.Scene();
        this.scene.background = new this.THREE.Color(0x1a1a2e);

        // Camera - positioned in corner looking at room center
        this.camera = new this.THREE.PerspectiveCamera(
            50,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            100
        );
        this.camera.position.set(6, 4, 6);
        this.camera.lookAt(0, 1.5, 0);

        // Renderer
        this.renderer = new this.THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = this.THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Lighting - interior style
        // Ambient light (general room brightness) - higher for visibility
        const ambientLight = new this.THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Window light (simulated outdoor light coming through window)
        const windowLight = new this.THREE.DirectionalLight(0xfff5e1, 1.0);
        windowLight.position.set(-8, 4, 0);
        // Make light point into the room
        const windowTarget = new this.THREE.Object3D();
        windowTarget.position.set(0, 1, 0);
        this.scene.add(windowTarget);
        windowLight.target = windowTarget;
        windowLight.castShadow = true;
        windowLight.shadow.mapSize.width = 1024;
        windowLight.shadow.mapSize.height = 1024;
        windowLight.shadow.camera.near = 0.5;
        windowLight.shadow.camera.far = 20;
        windowLight.shadow.camera.left = -8;
        windowLight.shadow.camera.right = 8;
        windowLight.shadow.camera.top = 8;
        windowLight.shadow.camera.bottom = -8;
        this.scene.add(windowLight);

        // Room lamp (point light) - brighter
        const lampLight = new this.THREE.PointLight(0xffeecc, 1.0, 10);
        lampLight.position.set(2, 2.2, -1.5);
        lampLight.castShadow = true;
        this.scene.add(lampLight);

        // Fill light from camera direction
        const fillLight = new this.THREE.DirectionalLight(0xffffff, 0.4);
        fillLight.position.set(5, 3, 5);
        this.scene.add(fillLight);

        // Additional hemisphere light for better ambient
        const hemiLight = new this.THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        this.scene.add(hemiLight);

        // Controls
        this.controls = new this.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        this.controls.target.set(0, 1.5, 0);
        this.controls.minDistance = 3;
        this.controls.maxDistance = 15;
        this.controls.maxPolarAngle = Math.PI / 2 + 0.2;
        this.controls.update();

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    /**
     * Creates a material for a specific slot
     */
    private createMaterial(slotId: InteriorSlotId): any {
        const color = this.palette.getColor(slotId);
        const material = new this.THREE.MeshStandardMaterial({
            color: new this.THREE.Color(color),
            roughness: 0.7,
            metalness: slotId === 'metal' ? 0.8 : 0.0,
            flatShading: true
        });
        this.materials.set(slotId, material);
        return material;
    }

    /**
     * Creates all room elements
     */
    private createRoom(): void {
        this.createFloor();
        this.createCeiling();
        this.createWalls();
        this.createTrim();
        this.createFurniture();
        this.createRug();
        this.createLamp();
        this.createAccentObjects();
    }

    /**
     * Creates the floor
     */
    private createFloor(): void {
        const material = this.createMaterial('floor');
        
        const floorGeometry = new this.THREE.PlaneGeometry(this.ROOM_WIDTH, this.ROOM_DEPTH, 8, 6);
        const floor = new this.THREE.Mesh(floorGeometry, material);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        this.scene.add(floor);

        this.meshGroups.set('floor', [floor]);
    }

    /**
     * Creates the ceiling
     */
    private createCeiling(): void {
        const material = this.createMaterial('ceiling');
        
        const ceilingGeometry = new this.THREE.PlaneGeometry(this.ROOM_WIDTH, this.ROOM_DEPTH);
        const ceiling = new this.THREE.Mesh(ceilingGeometry, material);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = this.ROOM_HEIGHT;
        this.scene.add(ceiling);

        this.meshGroups.set('ceiling', [ceiling]);
    }

    /**
     * Creates the walls (4 walls with window cutout in one)
     */
    private createWalls(): void {
        const material = this.createMaterial('wall');
        const walls: any[] = [];

        // Back wall (full)
        const backWall = new this.THREE.Mesh(
            new this.THREE.PlaneGeometry(this.ROOM_WIDTH, this.ROOM_HEIGHT),
            material
        );
        backWall.position.set(0, this.ROOM_HEIGHT / 2, -this.ROOM_DEPTH / 2);
        backWall.receiveShadow = true;
        this.scene.add(backWall);
        walls.push(backWall);

        // Front wall (full - camera side, so we can see inside)
        // Skip or make partial for visibility
        
        // Right wall (full)
        const rightWall = new this.THREE.Mesh(
            new this.THREE.PlaneGeometry(this.ROOM_DEPTH, this.ROOM_HEIGHT),
            material
        );
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.position.set(this.ROOM_WIDTH / 2, this.ROOM_HEIGHT / 2, 0);
        rightWall.receiveShadow = true;
        this.scene.add(rightWall);
        walls.push(rightWall);

        // Left wall with window (using shapes)
        const leftWallGroup = this.createWallWithWindow();
        this.scene.add(leftWallGroup);
        walls.push(leftWallGroup);

        this.meshGroups.set('wall', walls);
    }

    /**
     * Creates a wall with a window cutout
     */
    private createWallWithWindow(): any {
        const material = this.materials.get('wall');
        const group = new this.THREE.Group();

        // Wall segments around window
        const windowWidth = 1.8;
        const windowHeight = 1.5;
        const windowBottom = 0.9;
        const windowTop = windowBottom + windowHeight;

        // Left segment
        const leftSeg = new this.THREE.Mesh(
            new this.THREE.PlaneGeometry(1.5, this.ROOM_HEIGHT),
            material
        );
        leftSeg.position.set(0, this.ROOM_HEIGHT / 2, -this.ROOM_DEPTH / 2 + 0.75);
        group.add(leftSeg);

        // Right segment
        const rightSeg = new this.THREE.Mesh(
            new this.THREE.PlaneGeometry(1.5, this.ROOM_HEIGHT),
            material
        );
        rightSeg.position.set(0, this.ROOM_HEIGHT / 2, this.ROOM_DEPTH / 2 - 0.75);
        group.add(rightSeg);

        // Top segment (above window)
        const topSeg = new this.THREE.Mesh(
            new this.THREE.PlaneGeometry(windowWidth, this.ROOM_HEIGHT - windowTop),
            material
        );
        topSeg.position.set(0, windowTop + (this.ROOM_HEIGHT - windowTop) / 2, 0);
        group.add(topSeg);

        // Bottom segment (below window)
        const bottomSeg = new this.THREE.Mesh(
            new this.THREE.PlaneGeometry(windowWidth, windowBottom),
            material
        );
        bottomSeg.position.set(0, windowBottom / 2, 0);
        group.add(bottomSeg);

        // Window glass (semi-transparent sky color)
        const glassMaterial = new this.THREE.MeshStandardMaterial({
            color: 0x87CEEB,
            transparent: true,
            opacity: 0.3,
            roughness: 0.1
        });
        const glass = new this.THREE.Mesh(
            new this.THREE.PlaneGeometry(windowWidth, windowHeight),
            glassMaterial
        );
        glass.position.set(-0.01, windowBottom + windowHeight / 2, 0);
        group.add(glass);

        group.rotation.y = Math.PI / 2;
        group.position.set(-this.ROOM_WIDTH / 2, 0, 0);

        return group;
    }

    /**
     * Creates baseboards and window frame trim
     */
    private createTrim(): void {
        const material = this.createMaterial('trim');
        const trims: any[] = [];

        // Baseboards - simple boxes along the walls
        const baseboardHeight = 0.1;
        const baseboardDepth = 0.03;

        // Back baseboard
        const backBaseboard = new this.THREE.Mesh(
            new this.THREE.BoxGeometry(this.ROOM_WIDTH, baseboardHeight, baseboardDepth),
            material
        );
        backBaseboard.position.set(0, baseboardHeight / 2, -this.ROOM_DEPTH / 2 + baseboardDepth / 2);
        this.scene.add(backBaseboard);
        trims.push(backBaseboard);

        // Right baseboard
        const rightBaseboard = new this.THREE.Mesh(
            new this.THREE.BoxGeometry(baseboardDepth, baseboardHeight, this.ROOM_DEPTH),
            material
        );
        rightBaseboard.position.set(this.ROOM_WIDTH / 2 - baseboardDepth / 2, baseboardHeight / 2, 0);
        this.scene.add(rightBaseboard);
        trims.push(rightBaseboard);

        // Left baseboard (with gap for window)
        const leftBaseboardLeft = new this.THREE.Mesh(
            new this.THREE.BoxGeometry(baseboardDepth, baseboardHeight, 1.5),
            material
        );
        leftBaseboardLeft.position.set(-this.ROOM_WIDTH / 2 + baseboardDepth / 2, baseboardHeight / 2, -this.ROOM_DEPTH / 2 + 0.75);
        this.scene.add(leftBaseboardLeft);
        trims.push(leftBaseboardLeft);

        const leftBaseboardRight = new this.THREE.Mesh(
            new this.THREE.BoxGeometry(baseboardDepth, baseboardHeight, 1.5),
            material
        );
        leftBaseboardRight.position.set(-this.ROOM_WIDTH / 2 + baseboardDepth / 2, baseboardHeight / 2, this.ROOM_DEPTH / 2 - 0.75);
        this.scene.add(leftBaseboardRight);
        trims.push(leftBaseboardRight);

        // Window frame
        const frameMaterial = material;
        const frameThickness = 0.08;

        // Top frame
        const topFrame = new this.THREE.Mesh(
            new this.THREE.BoxGeometry(frameThickness, 2.0, frameThickness),
            frameMaterial
        );
        topFrame.position.set(-this.ROOM_WIDTH / 2, 1.6, -0.9);
        this.scene.add(topFrame);
        trims.push(topFrame);

        const topFrame2 = topFrame.clone();
        topFrame2.position.z = 0.9;
        this.scene.add(topFrame2);
        trims.push(topFrame2);

        this.meshGroups.set('trim', trims);
    }

    /**
     * Creates wooden furniture (table, shelf, chair)
     */
    private createFurniture(): void {
        const woodMaterial = this.createMaterial('wood');
        const woodItems: any[] = [];

        // Table
        const table = this.createTable(woodMaterial);
        table.position.set(-1.5, 0, 0);
        this.scene.add(table);
        woodItems.push(table);

        // Shelf on back wall
        const shelf = this.createShelf(woodMaterial);
        shelf.position.set(2, 1.5, -this.ROOM_DEPTH / 2 + 0.15);
        this.scene.add(shelf);
        woodItems.push(shelf);

        // Chair (wooden frame)
        const chair = this.createChair(woodMaterial);
        chair.position.set(-0.5, 0, 0.8);
        chair.rotation.y = -0.3;
        this.scene.add(chair);
        woodItems.push(chair);

        this.meshGroups.set('wood', woodItems);
    }

    /**
     * Creates a simple table
     */
    private createTable(material: any): any {
        const group = new this.THREE.Group();

        // Tabletop
        const top = new this.THREE.Mesh(
            new this.THREE.BoxGeometry(1.2, 0.05, 0.8),
            material
        );
        top.position.y = 0.75;
        top.castShadow = true;
        top.receiveShadow = true;
        group.add(top);

        // Legs
        const legGeom = new this.THREE.BoxGeometry(0.08, 0.75, 0.08);
        const positions = [
            [-0.5, 0.375, -0.3],
            [0.5, 0.375, -0.3],
            [-0.5, 0.375, 0.3],
            [0.5, 0.375, 0.3]
        ];
        positions.forEach(pos => {
            const leg = new this.THREE.Mesh(legGeom, material);
            leg.position.set(pos[0], pos[1], pos[2]);
            leg.castShadow = true;
            group.add(leg);
        });

        return group;
    }

    /**
     * Creates a wall shelf
     */
    private createShelf(material: any): any {
        const group = new this.THREE.Group();

        // Shelf board
        const board = new this.THREE.Mesh(
            new this.THREE.BoxGeometry(1.5, 0.04, 0.25),
            material
        );
        board.castShadow = true;
        group.add(board);

        return group;
    }

    /**
     * Creates a chair (frame only, cushion is fabric)
     */
    private createChair(material: any): any {
        const group = new this.THREE.Group();

        // Seat frame
        const seatFrame = new this.THREE.Mesh(
            new this.THREE.BoxGeometry(0.45, 0.04, 0.45),
            material
        );
        seatFrame.position.y = 0.45;
        group.add(seatFrame);

        // Back
        const back = new this.THREE.Mesh(
            new this.THREE.BoxGeometry(0.45, 0.5, 0.04),
            material
        );
        back.position.set(0, 0.75, -0.2);
        back.castShadow = true;
        group.add(back);

        // Legs
        const legGeom = new this.THREE.BoxGeometry(0.04, 0.45, 0.04);
        const legPositions = [
            [-0.18, 0.225, -0.18],
            [0.18, 0.225, -0.18],
            [-0.18, 0.225, 0.18],
            [0.18, 0.225, 0.18]
        ];
        legPositions.forEach(pos => {
            const leg = new this.THREE.Mesh(legGeom, material);
            leg.position.set(pos[0], pos[1], pos[2]);
            group.add(leg);
        });

        return group;
    }

    /**
     * Creates fabric elements (rug, chair cushion)
     */
    private createRug(): void {
        const fabricMaterial = this.createMaterial('fabric');
        const fabricItems: any[] = [];

        // Rug on floor
        const rug = new this.THREE.Mesh(
            new this.THREE.PlaneGeometry(2.5, 1.8),
            fabricMaterial
        );
        rug.rotation.x = -Math.PI / 2;
        rug.position.set(-0.5, 0.01, 0.3);
        rug.receiveShadow = true;
        this.scene.add(rug);
        fabricItems.push(rug);

        // Chair cushion
        const cushion = new this.THREE.Mesh(
            new this.THREE.BoxGeometry(0.4, 0.08, 0.4),
            fabricMaterial
        );
        cushion.position.set(-0.5, 0.51, 0.8);
        cushion.rotation.y = -0.3;
        cushion.castShadow = true;
        this.scene.add(cushion);
        fabricItems.push(cushion);

        this.meshGroups.set('fabric', fabricItems);
    }

    /**
     * Creates a floor lamp
     */
    private createLamp(): void {
        const metalMaterial = this.createMaterial('metal');
        const metalItems: any[] = [];

        const lampGroup = new this.THREE.Group();

        // Base
        const base = new this.THREE.Mesh(
            new this.THREE.CylinderGeometry(0.2, 0.25, 0.05, 8),
            metalMaterial
        );
        base.position.y = 0.025;
        lampGroup.add(base);

        // Pole
        const pole = new this.THREE.Mesh(
            new this.THREE.CylinderGeometry(0.03, 0.03, 1.8, 6),
            metalMaterial
        );
        pole.position.y = 0.95;
        pole.castShadow = true;
        lampGroup.add(pole);

        // Shade (using accent color for the light effect)
        const shadeMaterial = new this.THREE.MeshStandardMaterial({
            color: 0xf5f5dc,
            roughness: 0.9,
            transparent: true,
            opacity: 0.8
        });
        const shade = new this.THREE.Mesh(
            new this.THREE.CylinderGeometry(0.15, 0.25, 0.3, 8, 1, true),
            shadeMaterial
        );
        shade.position.y = 2.0;
        lampGroup.add(shade);

        lampGroup.position.set(2, 0, -1.5);
        this.scene.add(lampGroup);
        metalItems.push(lampGroup);

        // Shelf brackets (metal)
        const bracketGeom = new this.THREE.BoxGeometry(0.04, 0.04, 0.2);
        const bracket1 = new this.THREE.Mesh(bracketGeom, metalMaterial);
        bracket1.position.set(1.4, 1.4, -this.ROOM_DEPTH / 2 + 0.1);
        this.scene.add(bracket1);
        metalItems.push(bracket1);

        const bracket2 = bracket1.clone();
        bracket2.position.x = 2.6;
        this.scene.add(bracket2);
        metalItems.push(bracket2);

        this.meshGroups.set('metal', metalItems);
    }

    /**
     * Creates accent decorative objects
     */
    private createAccentObjects(): void {
        const accentMaterial = this.createMaterial('accent');
        accentMaterial.emissive = new this.THREE.Color(this.palette.getColor('accent'));
        accentMaterial.emissiveIntensity = 0.2;
        
        const accentItems: any[] = [];

        // Vase on table
        const vase = new this.THREE.Mesh(
            new this.THREE.CylinderGeometry(0.08, 0.1, 0.25, 8),
            accentMaterial
        );
        vase.position.set(-1.5, 0.9, 0);
        vase.castShadow = true;
        this.scene.add(vase);
        accentItems.push(vase);

        // Decorative object on shelf
        const deco = new this.THREE.Mesh(
            new this.THREE.OctahedronGeometry(0.12, 0),
            accentMaterial
        );
        deco.position.set(2.3, 1.62, -this.ROOM_DEPTH / 2 + 0.15);
        deco.rotation.y = 0.5;
        deco.castShadow = true;
        this.scene.add(deco);
        accentItems.push(deco);

        // Picture frame accent on back wall (colored square)
        const frameMaterial = new this.THREE.MeshStandardMaterial({
            color: new this.THREE.Color(this.palette.getColor('accent')),
            roughness: 0.5
        });
        const picture = new this.THREE.Mesh(
            new this.THREE.PlaneGeometry(0.6, 0.4),
            frameMaterial
        );
        picture.position.set(-1, 1.8, -this.ROOM_DEPTH / 2 + 0.01);
        this.scene.add(picture);
        accentItems.push(picture);

        this.meshGroups.set('accent', accentItems);
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
        const slotIds: InteriorSlotId[] = ['wall', 'floor', 'ceiling', 'wood', 'fabric', 'metal', 'trim', 'accent'];
        
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
            this.camera.position.set(6, 4, 6);
            this.controls.target.set(0, 1.5, 0);
            this.controls.update();
        }
    }

    /**
     * Exports the scene meshes to GLTF/GLB format
     */
    async exportToGLTF(binary: boolean = true): Promise<void> {
        if (!this.GLTFExporter) {
            console.error('GLTFExporter not loaded');
            return;
        }

        const exportGroup = new this.THREE.Group();
        exportGroup.name = 'InteriorPalette_Scene';

        let meshIndex = 0;

        const slotNames: Record<string, string> = {
            'wall': 'Walls',
            'floor': 'Floor',
            'ceiling': 'Ceiling',
            'wood': 'WoodFurniture',
            'fabric': 'Fabric',
            'metal': 'Metal',
            'trim': 'Trim',
            'accent': 'AccentDecor'
        };

        this.meshGroups.forEach((meshes, slotId) => {
            const slotGroup = new this.THREE.Group();
            slotGroup.name = slotNames[slotId] || slotId;

            meshes.forEach((mesh, idx) => {
                const clonedMesh = mesh.clone();
                
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

        const exporter = new this.GLTFExporter();
        
        const options = {
            binary: binary,
            onlyVisible: true,
            includeCustomExtensions: false
        };

        exporter.parse(
            exportGroup,
            (result: any) => {
                const extension = binary ? 'glb' : 'gltf';
                const mimeType = binary ? 'application/octet-stream' : 'application/json';
                
                let blob: Blob;
                if (binary) {
                    blob = new Blob([result], { type: mimeType });
                } else {
                    const output = JSON.stringify(result, null, 2);
                    blob = new Blob([output], { type: mimeType });
                }

                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `interior_scene.${extension}`;
                link.click();
                
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
