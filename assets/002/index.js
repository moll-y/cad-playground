import { mat4, vec2 } from "gl-matrix";

class Camera {
  constructor({ width, height }) {
    this.position = { x: 0, y: 0 };
    this.view_matrix = mat4.create();
    this.projection_matrix = mat4.ortho(
      mat4.create(),
      0,
      width,
      0,
      height,
      -1,
      1,
    );

    this.projection_view_matrix = mat4.multiply(
      mat4.create(),
      this.projection_matrix,
      this.view_matrix,
    );
  }

  update_view_matrix() {
    mat4.identity(this.view_matrix);

    mat4.translate(this.view_matrix, this.view_matrix, [
      this.position.x,
      this.position.y,
      0,
    ]);

    mat4.invert(this.view_matrix, this.view_matrix);

    mat4.multiply(
      this.projection_view_matrix,
      this.projection_matrix,
      this.view_matrix,
    );
  }
}

class Square {
  constructor({ device, pipeline, size, rgb }) {
    const half = size / 2;
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

  set_local_matrix(matrix) {
    mat4.copy(this.local_matrix, matrix);
  }

  update_local_matrix() {
    mat4.identity(this.local_matrix);
    mat4.translate(this.local_matrix, this.local_matrix, [
      this.position.x,
      this.position.y,
      0,
    ]);
  }

  update_world_matrix() {
    this.update_local_matrix();
    mat4.copy(this.world_matrix, this.local_matrix);
  }

  render({ device, pass }) {
    device.queue.writeBuffer(this.model_buffer, 0, this.world_matrix);
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
    var<uniform> projection_view: mat4x4<f32>;

    @group(1) @binding(0)
    var<uniform> model: mat4x4<f32>;

    struct VertexOutput {
      @builtin(position) position: vec4f,
      @location(0) rgba: vec4f,
    }

    @vertex
    fn vs(@location(0) position: vec2f, @location(1) rgb: vec3f) -> VertexOutput {
      var out: VertexOutput;

      out.position = projection_view * model * vec4f(position.xy, 0.0, 1.0);
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

  const projection_view_buffer = device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bind_group = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: projection_view_buffer } }],
  });

  const camera = new Camera({ width: canvas.width, height: canvas.height });
  device.queue.writeBuffer(
    projection_view_buffer,
    0,
    camera.projection_view_matrix,
  );

  const square = new Square({ device, pipeline, size: 100, rgb: [1, 1, 0] });
  square.position.x = canvas.width / 2;
  square.position.y = canvas.height / 2;

  let inverted_projection_view = mat4.create();
  let start_camera = { ...camera.position };
  let start_position = [0, 0];

  canvas.addEventListener("mousedown", (event) => {
    event.preventDefault();
    window.addEventListener("mousemove", handle_mouse_move);
    window.addEventListener("mouseup", handle_mouse_up);

    mat4.invert(inverted_projection_view, camera.projection_view_matrix);
    start_position = clip_to_world(event);
    start_camera = { ...camera.position };
  });

  function handle_mouse_move(event) {
    event.preventDefault();

    let end_position = clip_to_world(event);
    camera.position.x = start_camera.x + start_position[0] - end_position[0];
    camera.position.y = start_camera.y + start_position[1] - end_position[1];
  }

  function handle_mouse_up(event) {
    event.preventDefault();
    window.removeEventListener("mousemove", handle_mouse_move);
    window.removeEventListener("mouseup", handle_mouse_up);
  }

  function clip_to_world(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    //  clip = projection * view * world
    //  world = inverse(projection * view) * clip
    return [
      ...vec2.transformMat4(
        vec2.create(),
        [(x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1],
        inverted_projection_view,
      ),
    ];
  }

  // Handle Input
  const pressed_keys = new Set();
  const is_key_down = (key) => pressed_keys.has(key);
  document.addEventListener("keydown", (e) => pressed_keys.add(e.key));
  document.addEventListener("keyup", (e) => pressed_keys.delete(e.key));

  const MAX_FPS = 60;
  const FRAME_INTERVAL_MS = 1000 / MAX_FPS;
  let previousTimeMs = 60;

  function render() {
    requestAnimationFrame((currentTimeMs) => {
      const deltaTimeMs = currentTimeMs - previousTimeMs;

      if (deltaTimeMs >= FRAME_INTERVAL_MS) {
        if (is_key_down("ArrowLeft")) {
          camera.position.x -= 4;
        }

        if (is_key_down("ArrowRight")) {
          camera.position.x += 4;
        }

        if (is_key_down("ArrowUp")) {
          camera.position.y += 4;
        }

        if (is_key_down("ArrowDown")) {
          camera.position.y -= 4;
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

      camera.update_view_matrix();
      device.queue.writeBuffer(
        projection_view_buffer,
        0,
        camera.projection_view_matrix,
      );
      square.update_world_matrix();
      square.render({ device, pass });

      pass.end();

      const command_buffer = encoder.finish();
      device.queue.submit([command_buffer]);

      render();
    });
  }

  render();
}

start();
