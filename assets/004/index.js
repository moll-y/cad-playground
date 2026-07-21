async function start() {
  const canvas = document.getElementById("canvas");
  if (!canvas) {
    throw new Error("could not get canvas element.");
  }

  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("could not get webgpu context.");
  }

  if (!navigator.gpu) {
    throw new Error("navigator.gpu is not defined.");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("adapter is not defined.");
  }

  const device = await adapter.requestDevice();
  device.lost.then((info) => {
    console.log(`webgpu device was lost: ${info.message}`);
    if (info.reason !== "destroyed") {
      start();
    }
  });
  main(canvas, context, device);
}

function main(canvas, context, device) {
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format });

  const shader_module = device.createShaderModule({
    code: `
    @group(0) @binding(0)
    var<uniform> size: vec2<f32>;

    @vertex
    fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
      var positions = array<vec2f, 3>(
        vec2f(-1.0, -1.0),
        vec2f( 3.0, -1.0),
        vec2f(-1.0,  3.0),
      );
      return vec4f(positions[index], 0.0, 1.0);
    }

    @fragment
    fn fs(@builtin(position) position: vec4f) -> @location(0) vec4f {
      // Draw Circle.
      let uv = (position.xy / size) * 2.0 - 1.0;
      let radius = 0.25;

      if (length(uv) - radius <= 0.0) {
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }

      // Draw Grid.
      let width = 1.0;
      let space = 50.0;

      let x = position.x % space;
      let y = position.y % space;
      let v = min(x, space - x);
      let h = min(y, space - y);

      if (min(h, v) > width) {
        discard;
      }

      return vec4f(0.2, 0.2, 0.2, 1.0);
    }
    `,
  });
  shader_module.getCompilationInfo().then(console.log);

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: shader_module },
    fragment: {
      module: shader_module,
      targets: [{ format }],
    },
  });

  const size_buffer = device.createBuffer({
    size: (2 + 2) * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(
    size_buffer,
    0,
    new Float32Array([canvas.width, canvas.height, 0, 0]),
  );

  const bind_group = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: size_buffer } }],
  });

  function render() {
    const command_encoder = device.createCommandEncoder();
    const render_pass = command_encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: {
            r: 0,
            g: 0,
            b: 0,
            a: 1,
          },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    render_pass.setPipeline(pipeline);
    render_pass.setBindGroup(0, bind_group);
    render_pass.draw(3);
    render_pass.end();

    device.queue.submit([command_encoder.finish()]);

    requestAnimationFrame(render);
  }

  render();
}

start();
