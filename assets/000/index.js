import { mat4 } from "gl-matrix";

const MAX_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / MAX_FPS;

class Camera {
  constructor() {
    this.position = { x: 0, y: 0 };
    this.angle = 0;
    this.zoom = 1;

    this.worldMatrix = mat4.create();
    this.viewMatrix = mat4.create();

    this.update();
  }

  setPosition(x, y) {
    this.position.x = x;
    this.position.y = y;

    this.update();
  }

  move(dx, dy) {
    this.position.x += dx;
    this.position.y += dy;

    this.update();
  }

  rotate(delta) {
    this.angle += delta;

    this.update();
  }

  setZoom(zoom) {
    this.zoom = zoom;

    this.update();
  }

  update() {
    mat4.identity(this.worldMatrix);

    mat4.translate(this.worldMatrix, this.worldMatrix, [
      this.position.x,
      this.position.y,
      0,
    ]);

    mat4.rotateZ(this.worldMatrix, this.worldMatrix, this.angle);

    mat4.scale(this.worldMatrix, this.worldMatrix, [
      1 / this.zoom,
      1 / this.zoom,
      1,
    ]);
    // Why invert before scaling?
    mat4.invert(this.viewMatrix, this.worldMatrix);
  }
}

class SceneNode {
  constructor(shape = null) {
    this.shape = shape;
    this.parent = null;
    this.children = [];

    this.position = { x: 0, y: 0 };
    this.angle = 0;
    this.scale = { x: 1, y: 1 };

    this.localMatrix = mat4.create();
    this.worldMatrix = mat4.create();
  }

  addChild(child) {
    if (child.parent) {
      child.parent.removeChild(child);
    }

    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.slice(index, 1);
      child.parent = null;
    }
  }

  updateLocalMatrix() {
    mat4.identity(this.localMatrix);

    mat4.translate(this.localMatrix, this.localMatrix, [
      this.position.x,
      this.position.y,
      0,
    ]);

    mat4.rotateZ(this.localMatrix, this.localMatrix, this.angle);

    mat4.scale(this.localMatrix, this.localMatrix, [
      this.scale.x,
      this.scale.y,
      1,
    ]);
  }

  updateWorldMatrix(parentWorldMatrix = null) {
    this.updateLocalMatrix();
    if (parentWorldMatrix) {
      mat4.multiply(this.worldMatrix, parentWorldMatrix, this.localMatrix);
    } else {
      mat4.copy(this.worldMatrix, this.localMatrix);
    }
    for (const child of this.children) {
      child.updateWorldMatrix(this.worldMatrix);
    }
  }

  render(pass) {
    if (this.shape) {
      this.shape.setModelMatrix(this.worldMatrix);
      this.shape.upload();
      this.shape.render(pass);
    }

    for (const child of this.children) {
      child.render(pass);
    }
  }
}

class Square {
  constructor(device, bindGroupLayout, rgba = [1, 0, 0, 1]) {
    const size = 50;
    const half = size / 2;

    this.device = device;
    this.model = mat4.create();
    this.rgba = new Float32Array(rgba);

    this.vertices = new Float32Array([
      -half,
      -half,
      half,
      -half,
      -half,
      half,
      half,
      half,
    ]);
    this.indices = new Uint16Array([0, 1, 2, 2, 1, 3]);
    this.objectData = new Float32Array(20);
    this.indexCount = this.indices.length;

    this.vertexBuffer = device.createBuffer({
      size: this.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.indexBuffer = device.createBuffer({
      size: this.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    this.objectBuffer = device.createBuffer({
      size: this.objectData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.objectBuffer },
        },
      ],
    });

    // Static geometry is uploaded once.
    device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices);
    device.queue.writeBuffer(this.indexBuffer, 0, this.indices);

    this.upload();
  }

  setModelMatrix(matrix) {
    mat4.copy(this.model, matrix);
  }

  upload() {
    this.objectData.set(this.model, 0);
    this.objectData.set(this.rgba, 16);

    this.device.queue.writeBuffer(this.objectBuffer, 0, this.objectData);
  }
  render(pass) {
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, "uint16");
    pass.setBindGroup(1, this.bindGroup);
    pass.drawIndexed(this.indexCount);
  }
}

async function start() {
  const canvas = document.getElementById("canvas");
  if (!canvas) {
    throw new Error('Element "canvas" not found.');
  }

  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("This browser doesn't support WebGPU.");
  }

  if (!navigator.gpu) {
    throw new Error("This browser doesn't support WebGPU.");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("This browser supportts WebGPU but it appears disabled.");
  }

  const device = await adapter.requestDevice();
  device.lost.then((info) => {
    console.log(`WebGPU device was lost: ${info.message}`);
    if (info.reason !== "destroyed") {
      start();
    }
  });

  main(canvas, context, device);
}

function main(canvas, context, device) {
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format });

  const module = device.createShaderModule({
    code: `
    struct Object {
      model: mat4x4<f32>,
      color: vec4f,
    }

    struct VertexOut {
      @builtin(position) position: vec4f,
      @location(0) color: vec4f,
    }

    @group(0) @binding(0)
    var<uniform> projection: mat4x4<f32>;

    @group(0) @binding(1)
    var<uniform> view: mat4x4<f32>;

    @group(1) @binding(0)
    var<uniform> object: Object;

    @vertex
    fn vs(@location(0) position: vec2f) -> VertexOut {
      var out: VertexOut;

      out.position = projection * view * object.model * vec4f(position, 0.0, 1.0);
      out.color = object.color;

      return out;
    }

    @fragment
    fn fs(in: VertexOut) -> @location(0) vec4f {
      return in.color;
    }
    `,
  });

  module.getCompilationInfo().then((info) => console.log(info));

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 2 * 4,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x2",
            },
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format }],
    },
  });

  const renderPassDescriptor = {
    colorAttachments: [
      {
        // view: <- to be filled out when we render
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  const uniformBufferProjection = device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(
    uniformBufferProjection,
    0,
    new Float32Array([
      // Column 0
      2 / canvas.width,
      0,
      0,
      0,

      // Column 1
      0,
      2 / canvas.height,
      0,
      0,

      // Column 2
      0,
      0,
      1,
      0,

      // Column 3: translation
      -1,
      -1,
      0,
      1,
    ]),
  );

  const uniformBufferView = device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBufferProjection } },
      { binding: 1, resource: { buffer: uniformBufferView } },
    ],
  });

  const sunSquare = new Square(
    device,
    pipeline.getBindGroupLayout(1),
    [1, 1, 0, 1],
  );

  const earthSquare = new Square(
    device,
    pipeline.getBindGroupLayout(1),
    [1, 0, 1, 1],
  );

  const moonSquare = new Square(
    device,
    pipeline.getBindGroupLayout(1),
    [0, 0, 1, 1],
  );

  const root = new SceneNode();

  const solarSystemNode = new SceneNode();
  solarSystemNode.position.x = canvas.width / 2;
  solarSystemNode.position.y = canvas.height / 2;

  const sunNode = new SceneNode(sunSquare);
  sunNode.scale.x = 2;
  sunNode.scale.y = 2;

  const earthOrbitNode = new SceneNode();

  const earthNode = new SceneNode(earthSquare);
  earthNode.position.x = 120;
  earthNode.position.y = 0;
  earthNode.scale.x = 0.6;
  earthNode.scale.y = 0.6;

  const moonOrbitNode = new SceneNode();

  const moonNode = new SceneNode(moonSquare);
  moonNode.position.x = 50;
  moonNode.position.y = 0;
  moonNode.scale.x = 0.5;
  moonNode.scale.y = 0.5;

  root.addChild(solarSystemNode);

  solarSystemNode.addChild(sunNode);
  solarSystemNode.addChild(earthOrbitNode);

  earthOrbitNode.addChild(earthNode);

  earthNode.addChild(moonOrbitNode);
  moonOrbitNode.addChild(moonNode);

  const pressedKeys = new Set();
  const isKeyDown = (key) => pressedKeys.has(key);
  document.addEventListener("keydown", (e) => pressedKeys.add(e.key));
  document.addEventListener("keyup", (e) => pressedKeys.delete(e.key));

  function updatePhysics() {
    sunNode.angle += 0.02;

    earthOrbitNode.angle += 0.01;
    moonOrbitNode.angle += 0.06;

    earthNode.angle += 0.02;
    moonNode.angle += 0.04;

    if (isKeyDown("ArrowLeft")) {
      solarSystemNode.position.x -= 4;
    }

    if (isKeyDown("ArrowRight")) {
      solarSystemNode.position.x += 4;
    }

    if (isKeyDown("ArrowUp")) {
      solarSystemNode.position.y += 4;
    }

    if (isKeyDown("ArrowDown")) {
      solarSystemNode.position.y -= 4;
    }

    if (isKeyDown("a")) {
      camera.move(-2, 0);
    }

    if (isKeyDown("d")) {
      camera.move(2, 0);
    }

    if (isKeyDown("w")) {
      camera.move(0, 2);
    }

    if (isKeyDown("s")) {
      camera.move(0, -2);
    }
    if (isKeyDown("q")) {
      camera.setZoom(camera.zoom + 0.01);
    }

    if (isKeyDown("e")) {
      camera.setZoom(camera.zoom - 0.01);
    }
  }

  const camera = new Camera();
  function render() {
    // Why write the buffer inside the render function?
    device.queue.writeBuffer(uniformBufferView, 0, camera.viewMatrix);

    renderPassDescriptor.colorAttachments[0].view = context
      .getCurrentTexture()
      .createView();

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass(renderPassDescriptor);

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);

    root.updateWorldMatrix();
    root.render(pass);

    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
  }

  let previousTimeMs = 60;
  function update() {
    requestAnimationFrame((currentTimeMs) => {
      const deltaTimeMs = currentTimeMs - previousTimeMs;

      if (deltaTimeMs >= FRAME_INTERVAL_MS) {
        updatePhysics();
        previousTimeMs = currentTimeMs - (deltaTimeMs % FRAME_INTERVAL_MS);
      }

      render();
      update();
    });
  }

  update();
}

start();
