import { mat4 } from "gl-matrix";

class SceneGraph {
  constructor({ device, pipeline, shape }) {
    this.parent = null;
    this.shape = shape;
    this.children = [];
    this.angle = 0;
    this.position = { x: 0, y: 0 };
    this.model_matrix = mat4.create();
    this.local_matrix = mat4.create();
    this.model_buffer = device.createBuffer({
      size: 16 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.bind_group = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: this.model_buffer } }],
    });
  }

  add_child(child) {
    if (child.parent) {
      child.parent.remove_child(child);
    }

    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove_child(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  update_local_matrix() {
    mat4.identity(this.local_matrix);
    mat4.translate(this.local_matrix, this.local_matrix, [
      this.position.x,
      this.position.y,
      0,
    ]);
    mat4.rotateZ(this.local_matrix, this.local_matrix, this.angle);
  }

  update_model_matrix(parent_model_matrix = null) {
    this.update_local_matrix();

    if (parent_model_matrix) {
      mat4.multiply(this.model_matrix, parent_model_matrix, this.local_matrix);
    } else {
      mat4.copy(this.model_matrix, this.local_matrix);
    }

    for (const child of this.children) {
      child.update_model_matrix(this.model_matrix);
    }
  }

  render({ pass, device }) {
    if (this.shape) {
      device.queue.writeBuffer(this.model_buffer, 0, this.model_matrix);
      pass.setBindGroup(1, this.bind_group);
      this.shape.render(pass);
    }

    for (const child of this.children) {
      child.render({ pass, device });
    }
  }
}

class Square {
  constructor({ device, size, rgb }) {
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

    device.queue.writeBuffer(this.vertex_buffer, 0, this.vertices);
    device.queue.writeBuffer(this.index_buffer, 0, this.indices);
  }

  render(pass) {
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

  module.getCompilationInfo().then(console.log);

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
    fragment: { module, targets: [{ format }] },
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

  const sun = new Square({ device, size: 100, rgb: [1, 1, 0] });
  const earth = new Square({ device, size: 50, rgb: [0, 0, 1] });
  const moon = new Square({ device, size: 25, rgb: [1, 1, 1] });

  const scene_node = new SceneGraph({ device, pipeline });
  const sun_node = new SceneGraph({ device, pipeline, shape: sun });

  const earth_orbit_node = new SceneGraph({ device, pipeline });
  const earth_node = new SceneGraph({ device, pipeline, shape: earth });

  const moon_orbit_node = new SceneGraph({ device, pipeline });
  const moon_node = new SceneGraph({ device, pipeline, shape: moon });

  scene_node.add_child(sun_node);
  sun_node.add_child(earth_orbit_node);
  earth_orbit_node.add_child(earth_node);
  earth_node.add_child(moon_orbit_node);
  moon_orbit_node.add_child(moon_node);

  scene_node.position.x = canvas.width / 2;
  scene_node.position.y = canvas.height / 2;

  sun_node.position.x = 0;
  sun_node.position.y = 0;

  earth_orbit_node.position.x = 0;
  earth_orbit_node.position.y = 0;
  earth_node.position.x = 100;
  earth_node.position.y = 100;

  moon_orbit_node.position.x = 0;
  moon_orbit_node.position.y = 0;
  moon_node.position.x = 50;
  moon_node.position.y = 50;

  const MAX_FPS = 60;
  const FRAME_INTERVAL_MS = 1000 / MAX_FPS;
  let previous_time_ms = 60;

  function render() {
    requestAnimationFrame((current_time_ms) => {
      const delta_time_ms = current_time_ms - previous_time_ms;

      if (delta_time_ms >= FRAME_INTERVAL_MS) {
        scene_node.position.x = (scene_node.position.x + 1) % canvas.width;
        scene_node.position.y = (scene_node.position.y + 1) % canvas.height;

        sun_node.angle += 0.01;
        earth_orbit_node.angle += 0.05;
        earth_node.angle += 0.02;
        moon_orbit_node.angle += 0.05;
        moon_node.angle += 0.08;

        previous_time_ms =
          current_time_ms - (delta_time_ms % FRAME_INTERVAL_MS);
      }

      render_pass_descriptor.colorAttachments[0].view = context
        .getCurrentTexture()
        .createView();

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass(render_pass_descriptor);

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind_group);

      scene_node.update_model_matrix();
      scene_node.render({ pass, device });

      pass.end();

      const command_buffer = encoder.finish();
      device.queue.submit([command_buffer]);

      render();
    });
  }

  render();
}

start();
