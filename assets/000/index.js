// This is just to prove how tedious it is to do everything manually without
// using the Scene Graph data structure. In the next section I'll try to
// implement the scene Graph.
import { mat4 } from "gl-matrix";

class Square {
  constructor({ device, pipeline, size, rgb }) {
    const half = size / 2;
    // These vertices correspond to a Square.
    this.vertices = new Float32Array([
      ...[-half, -half],
      ...rgb,
      ...[half, -half],
      ...rgb,
      ...[-half, half],
      ...rgb,
      ...[half, half],
      ...rgb,
    ]);
    this.vertex_buffer = device.createBuffer({
      size: this.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.indices = new Uint16Array([0, 1, 2, 2, 1, 3]);
    this.index_buffer = device.createBuffer({
      size: this.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    this.position = { x: 0, y: 0 };
    this.local_matrix = mat4.create();
    this.world_matrix = mat4.create();

    this.model_buffer = device.createBuffer({
      size: 16 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.bind_group = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.model_buffer,
          },
        },
      ],
    });

    device.queue.writeBuffer(this.vertex_buffer, 0, this.vertices);
    device.queue.writeBuffer(this.index_buffer, 0, this.indices);
  }

  setLocalMatrix(matrix) {
    mat4.copy(this.local_matrix, matrix);
  }

  move(x, y) {
    this.position.x += x;
    this.position.y += y;
    mat4.translate(this.local_matrix, this.local_matrix, [x, y, 0]);
  }

  render(pass) {
    pass.setBindGroup(1, this.bind_group);
    pass.setVertexBuffer(0, this.vertex_buffer);
    pass.setIndexBuffer(this.index_buffer, "uint16");
    pass.drawIndexed(this.indices.length);
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
    throw new Error("This browser supports WebGPU but it appears disabled.");
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
    @group(0) @binding(0)
    var<uniform> projection: mat4x4<f32>;

    @group(1) @binding(0)
    var<uniform> model: mat4x4<f32>;

    struct VertexOutput {
      @builtin(position) position: vec4f,
      @location(0) rgba: vec4f,
    }

    @vertex
    fn vs(@location(0) position: vec2f, @location(1) rgb: vec3f) -> VertexOutput {
      var out: VertexOutput;

      out.position = projection * model * vec4f(position.xy, 0.0, 1.0);
      out.rgba = vec4f(rgb.xyz, 1.0);

      return out;
    }

    @fragment
    fn fs(in: VertexOutput) -> @location(0) vec4f {
      return in.rgba;
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
          arrayStride: 5 * 4,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x2",
            },
            {
              shaderLocation: 1,
              offset: 2 * 4,
              format: "float32x3",
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

  const render_pass_descriptor = {
    colorAttachments: [
      {
        view: null,
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  const projection_buffer = device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bind_group = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: projection_buffer } }],
  });

  // Projection matrix.
  const projection_matrix = mat4.create();
  mat4.ortho(projection_matrix, 0, canvas.width, 0, canvas.height, -1, 1);
  device.queue.writeBuffer(projection_buffer, 0, projection_matrix);

  const sun = new Square({ device, pipeline, size: 100, rgb: [1, 1, 0] });
  const earth = new Square({ device, pipeline, size: 50, rgb: [0, 0, 1] });
  const moon = new Square({ device, pipeline, size: 25, rgb: [1, 1, 1] });

  // Place the Sun at the center of the Canvas.
  mat4.translate(sun.local_matrix, sun.local_matrix, [
    canvas.width / 2,
    canvas.height / 2,
    0,
  ]);
  // The Sun has no parent. Therefore world_matrix = local_matrix
  mat4.copy(sun.world_matrix, sun.local_matrix);

  // Move the Earth relative to the Sun's position.
  mat4.translate(earth.local_matrix, earth.local_matrix, [50, 50, 0]);
  mat4.multiply(earth.world_matrix, sun.world_matrix, earth.local_matrix);

  // Move the Moon relative to the Earth's position.
  mat4.translate(moon.local_matrix, moon.local_matrix, [25, 25, 0]);
  mat4.multiply(moon.world_matrix, earth.world_matrix, moon.local_matrix);

  function update() {
    mat4.copy(sun.world_matrix, sun.local_matrix);
    // Move the Earth relative to the Sun's position.
    mat4.multiply(earth.world_matrix, sun.world_matrix, earth.local_matrix);
    // Move the Moon relative to the Earth's position.
    mat4.multiply(moon.world_matrix, earth.world_matrix, moon.local_matrix);
  }

  // Handle Input
  const pressedKeys = new Set();
  const isKeyDown = (key) => pressedKeys.has(key);
  document.addEventListener("keydown", (e) => pressedKeys.add(e.key));
  document.addEventListener("keyup", (e) => pressedKeys.delete(e.key));

  const MAX_FPS = 60;
  const FRAME_INTERVAL_MS = 1000 / MAX_FPS;
  let previousTimeMs = 60;

  function render() {
    requestAnimationFrame((currentTimeMs) => {
      const deltaTimeMs = currentTimeMs - previousTimeMs;

      if (deltaTimeMs >= FRAME_INTERVAL_MS) {
        if (isKeyDown("ArrowLeft")) {
          sun.move(-4, 0);
          update();
        }

        if (isKeyDown("ArrowRight")) {
          sun.move(+4, 0);
          update();
        }

        if (isKeyDown("ArrowUp")) {
          sun.move(0, +4);
          update();
        }

        if (isKeyDown("ArrowDown")) {
          sun.move(0, -4);
          update();
        }

        previousTimeMs = currentTimeMs - (deltaTimeMs % FRAME_INTERVAL_MS);
      }

      render_pass_descriptor.colorAttachments[0].view = context
        .getCurrentTexture()
        .createView();

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass(render_pass_descriptor);

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind_group);

      device.queue.writeBuffer(sun.model_buffer, 0, sun.world_matrix);
      device.queue.writeBuffer(earth.model_buffer, 0, earth.world_matrix);
      device.queue.writeBuffer(moon.model_buffer, 0, moon.world_matrix);

      sun.render(pass);
      earth.render(pass);
      moon.render(pass);

      pass.end();

      const command_buffer = encoder.finish();
      device.queue.submit([command_buffer]);

      render();
    });
  }

  render();
}

start();
