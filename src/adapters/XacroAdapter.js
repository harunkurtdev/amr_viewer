/**
 * Xacro Adapter
 *
 * Parses ROS Xacro files and converts them to URDF format using xacro-parser.
 *
 * Supported Features:
 * - Property definitions and substitutions (xacro:property)
 * - Macro definitions with parameters (xacro:macro)
 * - Conditional blocks (xacro:if, xacro:unless)
 * - File inclusions (xacro:include) with package:// and relative paths
 * - Python-style boolean constants (True/False)
 * - Arithmetic expressions and property evaluation
 *
 * Compatibility:
 * - ROS Jade and later (inOrder=true, requirePrefix=true, localProperties=true)
 * - Automatically injects True/False constants for compatibility with ROS xacro files
 *
 * Usage:
 * - Upload all related xacro files (main file and included files)
 * - The adapter automatically resolves file inclusions from the uploaded file map
 * - Mesh files are resolved using package:// paths or relative paths
 */
import { XacroParser } from 'xacro-parser';
import { URDFAdapter } from './URDFAdapter.js';

export class XacroAdapter {
    /**
     * Parse xacro content and convert to unified model
     * @param {string} xacroContent - Xacro file content
     * @param {string} fileName - Xacro file name (for working path)
     * @param {Map} fileMap - File map (path -> File object)
     * @param {File} file - Original file object (optional)
     * @returns {Promise<UnifiedRobotModel>}
     */
    static async parse(xacroContent, fileName, fileMap = null, file = null) {
        try {
            // Create xacro parser
            const parser = new XacroParser();

            // Configure parser for ROS Jade and later (default settings)
            parser.inOrder = true;
            parser.requirePrefix = true;
            parser.localProperties = true;

            // Set working path (directory where xacro file is located)
            const workingPath = fileName.includes('/')
                ? fileName.substring(0, fileName.lastIndexOf('/') + 1)
                : '';
            parser.workingPath = workingPath;

            // Normalize modern xacro syntax that xacro-parser doesn't support
            // (pass-through macro params "^|default", Python ternary expressions)
            xacroContent = this.normalizeXacroSyntax(xacroContent);

            // Inject Python-style boolean constants as xacro properties
            // Some xacro files use True/False (capitalized) in conditions
            xacroContent = this.injectBooleanConstants(xacroContent);

            // Extract and set xacro arguments with their default values
            // Also add common ROS arguments that might be used without definition
            const xacroArgs = this.extractXacroArguments(xacroContent);

            // Add common ROS arguments with sensible defaults if not already defined
            if (!xacroArgs.hasOwnProperty('DEBUG')) {
                xacroArgs.DEBUG = 'false';
            }
            if (!xacroArgs.hasOwnProperty('SELF_COLLIDE')) {
                xacroArgs.SELF_COLLIDE = 'false';
            }

            parser.arguments = xacroArgs;

            // If fileMap provided, setup custom file loader
            if (fileMap) {
                parser.getFileContents = async (path) => {
                    return await this.loadFileFromMap(path, fileMap, workingPath);
                };
            }

            // Parse xacro to URDF XML
            let urdfXML = await parser.parse(xacroContent);

            // If the file only DEFINES macros and never instantiates them, the
            // resulting robot is empty (e.g. a "<name>_macro.urdf.xacro" library
            // file, or a description file that expects a higher-level wrapper).
            // Auto-instantiate a top-level robot macro so it still renders.
            if (!this.hasLinks(urdfXML)) {
                const augmented = this.buildMacroInstantiation(xacroContent);
                if (augmented) {
                    const parser2 = new XacroParser();
                    parser2.inOrder = true;
                    parser2.requirePrefix = true;
                    parser2.localProperties = true;
                    parser2.workingPath = workingPath;
                    parser2.arguments = xacroArgs;
                    if (fileMap) {
                        parser2.getFileContents = async (path) =>
                            await this.loadFileFromMap(path, fileMap, workingPath);
                    }
                    try {
                        const retry = await parser2.parse(augmented);
                        if (this.hasLinks(retry)) {
                            console.info('[XacroAdapter] auto-instantiated top-level macro (file defined a macro but never called it)');
                            urdfXML = retry;
                        }
                    } catch (e) {
                        console.warn('[XacroAdapter] auto-instantiation failed:', e.message);
                    }
                }
            }

            // Convert XMLDocument to string
            const serializer = new XMLSerializer();
            let urdfString = serializer.serializeToString(urdfXML);

            // Clean up the XML string - remove empty xmlns attributes that might cause issues
            urdfString = urdfString.replace(/\sxmlns=""/g, '');

            // Re-parse the URDF string with DOMParser to create a clean XMLDocument
            // This removes any xacro-specific nodes that urdf-loader might not handle
            const domParser = new DOMParser();
            const cleanUrdfXML = domParser.parseFromString(urdfString, 'text/xml');

            // Check for parsing errors
            const parseError = cleanUrdfXML.querySelector('parsererror');
            if (parseError) {
                console.error('[XacroAdapter] XML parsing error:', parseError.textContent);
                throw new Error('Generated URDF has invalid XML: ' + parseError.textContent);
            }

            // Remove problematic elements that urdf-loader might not handle well
            // Remove gazebo elements (plugins, sensors, etc.)
            const gazeboElements = cleanUrdfXML.querySelectorAll('gazebo');
            gazeboElements.forEach(el => el.parentNode?.removeChild(el));

            // Remove transmission elements (these are for Gazebo/ROS control)
            const transmissionElements = cleanUrdfXML.querySelectorAll('transmission');
            transmissionElements.forEach(el => el.parentNode?.removeChild(el));

            // Remove visual/collision elements with empty geometry tags
            this.removeEmptyGeometry(cleanUrdfXML);

            // Clean up empty text nodes and comments that might cause issues
            this.cleanXMLNodes(cleanUrdfXML.documentElement);

            // Convert the clean XMLDocument back to string for URDFLoader
            const finalUrdfString = serializer.serializeToString(cleanUrdfXML);

            // Now use existing URDF loading infrastructure
            // Import URDFLoader dynamically
            const urdfModule = await import('urdf-loader');
            const URDFLoader = urdfModule.URDFLoader || urdfModule.default || urdfModule;

            return new Promise((resolve, reject) => {
                const loader = new URDFLoader();
                loader.parseCollision = true;

                // Extract directory where URDF file is located
                const urdfDir = workingPath;

                // If file map provided, setup resource loader (same as URDF loading)
                if (fileMap) {
                    // Parse URDF content, find all used package names
                    const packages = this.extractPackagesFromURDF(finalUrdfString);

                    // Build package map
                    const packageMap = {};
                    packages.forEach(pkg => {
                        packageMap[pkg] = pkg;
                    });
                    packageMap[''] = '';

                    loader.packages = packageMap;

                    // Set URL Modifier (same as URDF loading)
                    const urlModifier = (url) => {
                        // Handle blob URLs
                        if (url.startsWith('blob:')) {
                            const blobMatch = url.match(/^blob:https?:\/\/[^\/]+\/(.+)$/);
                            if (blobMatch && blobMatch[1]) {
                                const fileName = blobMatch[1];
                                if (/\.(jpg|jpeg|png|gif|bmp|tga|tiff|webp|dae|stl|obj|gltf|glb)$/i.test(fileName)) {
                                    url = fileName;
                                } else {
                                    return url;
                                }
                            } else {
                                return url;
                            }
                        }

                        const isTextureFile = /\.(jpg|jpeg|png|gif|bmp|tga|tiff|webp)$/i.test(url);
                        const isMeshFile = /\.(dae|stl|obj|gltf|glb)$/i.test(url);

                        let meshPath = url;

                        // Remove http:// or https:// prefix
                        if (meshPath.startsWith('http://') || meshPath.startsWith('https://')) {
                            try {
                                const urlObj = new URL(meshPath);
                                meshPath = urlObj.pathname;
                                if (meshPath.startsWith('/')) {
                                    meshPath = meshPath.substring(1);
                                }
                            } catch (e) {
                                // Invalid URL, use as-is
                            }
                        }

                        // Remove package:// prefix
                        if (meshPath.startsWith('package://')) {
                            meshPath = meshPath.replace(/^package:\/\//, '');
                            const parts = meshPath.split('/');
                            if (parts.length > 1) {
                                meshPath = parts.slice(1).join('/');
                            }
                        }

                        // Remove leading ./
                        meshPath = meshPath.replace(/^\.\//, '');

                        // Handle relative paths
                        let normalizedPath = meshPath;
                        if (meshPath.includes('../')) {
                            const parts = meshPath.split('/');
                            const resolvedParts = [];
                            for (const part of parts) {
                                if (part === '..') {
                                    resolvedParts.pop();
                                } else if (part !== '.' && part !== '') {
                                    resolvedParts.push(part);
                                }
                            }
                            normalizedPath = resolvedParts.join('/');
                        }

                        // Build full path
                        const fullPath = urdfDir + normalizedPath;
                        const altPath = urdfDir + meshPath;

                        // Find file in fileMap
                        let matchedFile = fileMap.get(fullPath);

                        if (!matchedFile && altPath !== fullPath) {
                            matchedFile = fileMap.get(altPath);
                        }

                        if (!matchedFile) {
                            matchedFile = fileMap.get(normalizedPath);
                        }

                        if (!matchedFile) {
                            matchedFile = fileMap.get(meshPath);
                        }

                        if (!matchedFile) {
                            const targetFileName = normalizedPath.split('/').pop() || meshPath.split('/').pop();
                            for (const [key, file] of fileMap.entries()) {
                                const keyFileName = key.split('/').pop();
                                if (keyFileName === targetFileName) {
                                    matchedFile = file;
                                    break;
                                }
                            }
                        }

                        if (matchedFile) {
                            const bloburl = URL.createObjectURL(matchedFile);
                            return bloburl;
                        }

                        return url;
                    };

                    loader.manager.setURLModifier(urlModifier);

                    // Custom loadMeshCb (same as URDF loading)
                    const originalLoadMeshCb = loader.loadMeshCb || loader.defaultMeshLoader.bind(loader);
                    loader.loadMeshCb = (path, manager, done) => {
                        this.findFileInMapByPath(path, fileMap, urdfDir).then(file => {
                            if (file) {
                                const ext = (file.name || path).toLowerCase().split('.').pop();
                                this.loadMeshFileAsync(file, ext, manager).then(meshObject => {
                                    if (meshObject) {
                                        done(meshObject, null);
                                    } else {
                                        done(null, new Error(`Failed to load mesh file: ${path}`));
                                    }
                                }).catch(err => {
                                    console.error(`Failed to load mesh: ${path}`, err);
                                    done(null, err);
                                });
                            } else {
                                originalLoadMeshCb(path, manager, done);
                            }
                        }).catch(error => {
                            console.error(`Failed to find file: ${path}`, error);
                            originalLoadMeshCb(path, manager, done);
                        });
                    };
                }

                // Create temporary URL for URDF content
                const blob = new Blob([finalUrdfString], { type: 'text/xml' });
                const url = URL.createObjectURL(blob);

                loader.load(url, (robot) => {
                    URL.revokeObjectURL(url);

                    // Convert to unified model using URDFAdapter
                    try {
                        const model = URDFAdapter.convert(robot, finalUrdfString);
                        resolve(model);
                    } catch (error) {
                        console.error('[XacroAdapter] URDF conversion error:', error);
                        reject(new Error('URDF conversion failed: ' + error.message));
                    }
                }, undefined, (error) => {
                    URL.revokeObjectURL(url);
                    console.error('[XacroAdapter] URDF loading error:', error);
                    reject(new Error('URDF loading failed: ' + (error.message || error)));
                });
            });
        } catch (error) {
            console.error('[XacroAdapter] Xacro parsing error:', error);
            throw new Error('Xacro parsing failed: ' + error.message);
        }
    }

    /**
     * Load file from fileMap for xacro includes
     * @param {string} path - File path
     * @param {Map} fileMap - File map
     * @param {string} workingPath - Working directory
     * @returns {Promise<string>}
     */
    static async loadFileFromMap(path, fileMap, workingPath) {
        // Clean path - remove leading slash if present
        let cleanPath = path;
        if (cleanPath.startsWith('/')) {
            cleanPath = cleanPath.substring(1);
        }

        // Remove leading ./
        cleanPath = cleanPath.replace(/^\.\//, '');

        // Try different path combinations
        const possiblePaths = [
            cleanPath,
            workingPath + cleanPath,
            path,
            workingPath + path.replace(/^\/+/, ''),
            // Also try without the first directory component
            cleanPath.includes('/') ? cleanPath.substring(cleanPath.indexOf('/') + 1) : cleanPath,
        ];

        // Try each path
        for (const tryPath of possiblePaths) {
            const file = fileMap.get(tryPath);
            if (file) {
                return this.normalizeXacroSyntax(await file.text());
            }
        }

        // Try filename only match
        const fileName = cleanPath.split('/').pop();
        for (const [key, file] of fileMap.entries()) {
            const keyFileName = key.split('/').pop();
            if (keyFileName === fileName) {
                return this.normalizeXacroSyntax(await file.text());
            }
        }

        console.error('[XacroAdapter] Cannot find included file:', path);
        throw new Error(`Cannot find included file: ${path}`);
    }

    /**
     * Remove visual/collision elements with empty geometry tags
     * xacro-parser may not fully expand conditional geometry (xacro:if)
     * We'll just remove these empty visual elements rather than try to fix them
     * @param {XMLDocument} xmlDoc - XML document to clean
     */
    static removeEmptyGeometry(xmlDoc) {
        // Find all geometry elements
        const geometryElements = xmlDoc.querySelectorAll('geometry');

        geometryElements.forEach(geom => {
            // Check if geometry is empty (no child elements)
            if (!geom.children || geom.children.length === 0) {
                // Find the parent visual or collision element
                let parent = geom.parentNode;
                if (parent) {
                    const grandParent = parent.parentNode;
                    if (grandParent) {
                        if (parent.nodeName === 'visual' || parent.nodeName === 'collision') {
                            // Remove empty visual/collision elements
                            grandParent.removeChild(parent);
                        }
                    }
                }
            }
        });
    }

    /**
     * Recursively clean XML nodes - remove empty text nodes and comments
     * @param {Element} element - Element to clean
     */
    static cleanXMLNodes(element) {
        if (!element || !element.childNodes) return;

        const nodesToRemove = [];

        // Collect nodes to remove
        for (let i = 0; i < element.childNodes.length; i++) {
            const node = element.childNodes[i];

            // Remove comments
            if (node.nodeType === Node.COMMENT_NODE) {
                nodesToRemove.push(node);
            }
            // Remove empty or whitespace-only text nodes
            else if (node.nodeType === Node.TEXT_NODE) {
                if (!node.nodeValue || node.nodeValue.trim() === '') {
                    nodesToRemove.push(node);
                }
            }
            // Recursively clean element nodes
            else if (node.nodeType === Node.ELEMENT_NODE) {
                this.cleanXMLNodes(node);
            }
        }

        // Remove collected nodes
        nodesToRemove.forEach(node => {
            element.removeChild(node);
        });
    }

    /**
     * Extract package names from URDF content
     * @param {string} urdfContent - URDF content
     * @returns {Set<string>}
     */
    static extractPackagesFromURDF(urdfContent) {
        const packages = new Set();
        const packageRegex = /package:\/\/([^\/]+)/g;
        let match;
        while ((match = packageRegex.exec(urdfContent)) !== null) {
            packages.add(match[1]);
        }
        return packages;
    }

    /**
     * Find file in fileMap by path
     * @param {string} path - File path
     * @param {Map} fileMap - File map
     * @param {string} urdfDir - URDF directory
     * @returns {Promise<File|null>}
     */
    static async findFileInMapByPath(path, fileMap, urdfDir) {
        let meshPath = path;

        // Remove blob: prefix
        meshPath = meshPath.replace(/^blob:[^\/]+\//, '');

        // Remove package:// prefix
        if (meshPath.startsWith('package://')) {
            meshPath = meshPath.replace(/^package:\/\//, '');
            const parts = meshPath.split('/');
            if (parts.length > 1) {
                meshPath = parts.slice(1).join('/');
            }
        }

        // Remove leading ./
        meshPath = meshPath.replace(/^\.\//, '');

        // Build full path
        const fullPath = urdfDir + meshPath;

        // Try full path
        let file = fileMap.get(fullPath);
        if (file) return file;

        // Try path without directory
        file = fileMap.get(meshPath);
        if (file) return file;

        // Try filename match
        const targetFileName = meshPath.split('/').pop();
        for (const [key, f] of fileMap.entries()) {
            const keyFileName = key.split('/').pop();
            if (keyFileName === targetFileName) {
                return f;
            }
        }

        return null;
    }

    /**
     * Load mesh file asynchronously
     * @param {File} file - File object
     * @param {string} ext - File extension
     * @param {THREE.LoadingManager} manager - Loading manager
     * @returns {Promise<THREE.Object3D>}
     */
    static async loadMeshFileAsync(file, ext, manager) {
        const THREE = await import('three');
        const blobUrl = URL.createObjectURL(file);

        try {
            let meshObject = null;

            switch (ext) {
                case 'stl': {
                    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
                    const stlLoader = new STLLoader(manager);
                    const stlGeometry = await new Promise((resolve, reject) => {
                        stlLoader.load(blobUrl, resolve, undefined, reject);
                    });
                    const stlMaterial = new THREE.MeshPhongMaterial();
                    meshObject = new THREE.Mesh(stlGeometry, stlMaterial);
                    break;
                }

                case 'dae': {
                    const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
                    const colladaLoader = new ColladaLoader(manager);
                    const colladaModel = await new Promise((resolve, reject) => {
                        colladaLoader.load(blobUrl, resolve, undefined, reject);
                    });
                    meshObject = colladaModel.scene;

                    // Remove lights
                    if (meshObject && meshObject.traverse) {
                        const lightsToRemove = [];
                        meshObject.traverse(child => {
                            if (child.isLight) {
                                lightsToRemove.push(child);
                            }
                        });
                        lightsToRemove.forEach(light => {
                            if (light.parent) {
                                light.parent.remove(light);
                            }
                        });
                    }
                    break;
                }

                case 'obj': {
                    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
                    const objLoader = new OBJLoader(manager);
                    meshObject = await new Promise((resolve, reject) => {
                        objLoader.load(blobUrl, resolve, undefined, reject);
                    });
                    break;
                }

                case 'gltf':
                case 'glb': {
                    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
                    const gltfLoader = new GLTFLoader(manager);
                    const gltfModel = await new Promise((resolve, reject) => {
                        gltfLoader.load(blobUrl, resolve, undefined, reject);
                    });
                    meshObject = gltfModel.scene;
                    break;
                }

                default:
                    console.warn(`Unsupported file format: ${ext}`);
                    URL.revokeObjectURL(blobUrl);
                    return null;
            }

            URL.revokeObjectURL(blobUrl);
            return meshObject;
        } catch (error) {
            URL.revokeObjectURL(blobUrl);
            console.error(`Failed to load mesh file: ${file.name}`, error);
            throw error;
        }
    }

    /**
     * Normalize modern xacro syntax that the JS xacro-parser (v0.3.x) cannot
     * handle, so real ROS 2 packages import instead of failing outright:
     *
     *  1. Pass-through / inherited macro parameter defaults:
     *       params="mimic_mult:=^|none"  ->  params="mimic_mult:=none"
     *       params="foo:=^"              ->  params="foo:="
     *     The library throws "ROS Jade pass-through notation not supported".
     *     We drop the inheritance and keep the fallback default (or empty),
     *     which is correct whenever the caller passes the value or relies on
     *     the default - the overwhelmingly common case.
     *
     *  2. Python ternary expressions inside ${...}:
     *       ${50.0 if drive else 0.0}    ->  ${(drive) ? (50.0) : (0.0)}
     *     The library's expression engine supports JS-style ?: but not the
     *     Python "A if C else B" form.
     *
     * @param {string} content - raw xacro content
     * @returns {string}
     */
    static normalizeXacroSyntax(content) {
        if (!content || typeof content !== 'string') return content;

        // 1) Pass-through macro param notation.
        content = content
            .replace(/:=\^\|/g, ':=')          // "name:=^|default" -> "name:=default"
            .replace(/:=\^(?=[\s"'])/g, ':=');  // "name:=^" -> "name:="

        // 2) Python ternary -> JS ternary, within each ${...} (no nested braces).
        content = content.replace(/\$\{([^{}]*)\}/g, (full, expr) => {
            const m = expr.match(/^([\s\S]+?)\bif\b([\s\S]+?)\belse\b([\s\S]+)$/);
            if (!m) return full;
            return '${(' + m[2].trim() + ') ? (' + m[1].trim() + ') : (' + m[3].trim() + ')}';
        });

        // 3) Rename macros whose name collides with a URDF/geometry element tag.
        //    xacro-parser mis-expands a literal <box>/<cylinder>/... element as a
        //    call to a same-named macro (even with requirePrefix), which breaks
        //    parsing ("Failed to process expression ${name}"). Renaming only the
        //    xacro:-prefixed references (definition + calls) is safe: literal
        //    URDF tags are never xacro:-prefixed, so they stay untouched.
        content = this.renameReservedMacros(content);

        return content;
    }

    /** Element tags that commonly clash with macro names. */
    static get RESERVED_MACRO_NAMES() {
        return [
            'box', 'cylinder', 'sphere', 'mesh', 'plane', 'link', 'joint',
            'visual', 'collision', 'inertial', 'inertia', 'material', 'geometry',
            'origin', 'axis', 'limit', 'dynamics', 'mimic', 'robot', 'world',
            'color', 'texture', 'mass', 'parent', 'child'
        ];
    }

    /** Whether a parsed URDF document contains at least one <link>. */
    static hasLinks(xmlDoc) {
        try {
            return !!(xmlDoc && xmlDoc.querySelectorAll && xmlDoc.querySelectorAll('link').length > 0);
        } catch (e) {
            return true; // on uncertainty, don't trigger auto-instantiation
        }
    }

    /**
     * For a xacro file that only defines macros, synthesize a top-level
     * instantiation of the most likely "robot" macro and return the augmented
     * content (or null if none looks instantiable). Heuristics:
     *  - prefer a macro with a `parent` parameter (attach-to-parent robots),
     *    matching the <robot name> when possible;
     *  - otherwise the first macro that takes a block (`*origin`) parameter.
     * Required scalar params get a base_link/"" value; block params get an
     * empty element (an `<origin>` for the common `*origin`).
     */
    static buildMacroInstantiation(content) {
        const macroRe = /<xacro:macro\s+name=["']([^"']+)["']\s+params=["']([^"']*)["']/g;
        const macros = [];
        let m;
        while ((m = macroRe.exec(content)) !== null) {
            macros.push({ name: m[1], params: m[2].trim() });
        }
        if (macros.length === 0) return null;

        const parseParams = (p) => p.split(/\s+/).filter(Boolean).map(tok => {
            if (tok.startsWith('**')) return { kind: 'block', name: tok.slice(2) };
            if (tok.startsWith('*')) return { kind: 'block', name: tok.slice(1) };
            if (tok.includes(':=')) return { kind: 'opt', name: tok.slice(0, tok.indexOf(':=')) };
            return { kind: 'req', name: tok };
        });

        const robotName = (content.match(/<robot[^>]*\bname=["']([^"']+)["']/) || [])[1];
        const withParent = macros.filter(mac => parseParams(mac.params).some(p => p.name === 'parent'));

        let cand = withParent.find(mac => robotName && mac.name === robotName)
            || withParent[0]
            || macros.find(mac => parseParams(mac.params).some(p => p.kind === 'block'));
        if (!cand) return null;

        let attrs = '';
        let blocks = '';
        for (const p of parseParams(cand.params)) {
            if (p.kind === 'block') {
                blocks += p.name === 'origin'
                    ? '<origin xyz="0 0 0" rpy="0 0 0"/>'
                    : `<${p.name}/>`;
            } else if (p.kind === 'req') {
                attrs += ` ${p.name}="${p.name === 'parent' ? 'base_link' : ''}"`;
            }
        }

        const call = `<link name="base_link"/>\n<xacro:${cand.name}${attrs}>${blocks}</xacro:${cand.name}>`;
        if (!/<\/robot>\s*$/.test(content)) return null;
        return content.replace(/<\/robot>\s*$/, call + '\n</robot>');
    }

    static renameReservedMacros(content) {
        const suffix = '__xm';
        for (const tag of this.RESERVED_MACRO_NAMES) {
            content = content
                // <xacro:macro name="box"> -> <xacro:macro name="box__xm">
                .replace(new RegExp(`(<xacro:macro\\s+name=["'])${tag}(["'])`, 'g'), `$1${tag}${suffix}$2`)
                // <xacro:box ...> / <xacro:box/> -> <xacro:box__xm ...>
                .replace(new RegExp(`<xacro:${tag}(?=[\\s/>])`, 'g'), `<xacro:${tag}${suffix}`)
                // </xacro:box> -> </xacro:box__xm>
                .replace(new RegExp(`</xacro:${tag}>`, 'g'), `</xacro:${tag}${suffix}>`);
        }
        return content;
    }

    /**
     * Inject Python-style boolean constants (True/False) into xacro content
     * Some xacro files use capitalized True/False in conditional expressions
     * The parameters are passed as strings ("True", "False") but compared to constants
     * We define the constants to match the string values for comparison to work
     * @param {string} xacroContent - Original xacro content
     * @returns {string} - Modified xacro content with boolean constants defined
     */
    static injectBooleanConstants(xacroContent) {
        // Find the robot tag opening
        const robotTagMatch = xacroContent.match(/(<robot[^>]*>)/);
        if (!robotTagMatch) {
            return xacroContent;
        }

        // Define True/False as string properties for comparison
        // When mirror_dae="True" is passed, it becomes the string "True"
        // We want ${mirror_dae == True} to work, so True must also be "True"
        const booleanProperties = `
    <!-- Injected by XacroAdapter: Python-style boolean constants -->
    <xacro:property name="True" value="True"/>
    <xacro:property name="False" value="False"/>
`;

        const insertPosition = robotTagMatch.index + robotTagMatch[0].length;
        return xacroContent.substring(0, insertPosition) +
               booleanProperties +
               xacroContent.substring(insertPosition);
    }

    /**
     * Extract xacro arguments and their default values from xacro content
     * Xacro files can define arguments using <xacro:arg name="..." default="..."/>
     * These need to be provided to the parser via parser.arguments
     * @param {string} xacroContent - Xacro file content
     * @returns {Object} - Object with argument names as keys and default values
     */
    static extractXacroArguments(xacroContent) {
        const args = {};

        // Match <xacro:arg name="NAME" default="VALUE"/>
        // Also match <arg name="NAME" default="VALUE"/> (without xacro: prefix)
        const argPattern = /<(?:xacro:)?arg\s+name=["']([^"']+)["'](?:\s+default=["']([^"']*)["'])?/g;

        let match;
        while ((match = argPattern.exec(xacroContent)) !== null) {
            const argName = match[1];
            const defaultValue = match[2] || 'false'; // Default to 'false' if no default specified
            args[argName] = defaultValue;
        }

        return args;
    }
}


