import { mat4 } from "gl-matrix";

const canvas = document.getElementById("canvas");
if (!canvas) {
  throw new Error("canvas is not defined.");
}

const gl = canvas.getContext("webgl2");
if (!gl) {
  throw new Error("webgl2 context is not defined.");
}

const vshader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(
  vshader,
  `#version 300 es                                       \n
                                                         \n
  layout (location = 0) in vec4 position;                \n
  layout (location = 1) in vec4 color;                   \n
                                                         \n
  uniform mat4 model;                                    \n
  uniform mat4 projection;                               \n
                                                         \n
  out vec4 in_color;                                     \n
                                                         \n
  void main(void) {                                      \n
      gl_Position = projection * model * position;       \n
      in_color = color;                                  \n
  }`,
);

gl.compileShader(vshader);
if (!gl.getShaderParameter(vshader, gl.COMPILE_STATUS)) {
  throw new Error(`could not compile vshader: ${gl.getShaderInfoLog(vshader)}`);
}

const fshader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(
  fshader,
  `#version 300 es                                       \n
                                                         \n
  precision highp float;                                 \n
                                                         \n
  in vec4 in_color;                                      \n
  out vec4 color;                                        \n
                                                         \n
  void main(void) {                                      \n
      color = in_color;                                  \n
  }`,
);

gl.compileShader(fshader);
if (!gl.getShaderParameter(fshader, gl.COMPILE_STATUS)) {
  throw new Error(`could not compile fshader: ${gl.getShaderInfoLog(fshader)}`);
}

const program = gl.createProgram();
gl.attachShader(program, vshader);
gl.attachShader(program, fshader);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(`could not link program: ${gl.getProgramInfoLog(program)}`);
}

gl.deleteShader(vshader);
gl.deleteShader(fshader);

const uniformModel = gl.getUniformLocation(program, "model");
if (uniformModel === null) {
  throw new Error(`could not find uniform location: "model".`);
}

const uniformProjection = gl.getUniformLocation(program, "projection");
if (uniformProjection === null) {
  throw new Error(`could not find uniform location: "projection".`);
}

const vao = gl.createVertexArray();
const ebo = gl.createBuffer();
const vbo = gl.createBuffer();
const cbo = gl.createBuffer();

gl.bindVertexArray(vao);
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([
    ...[-0.1, 0.0, 0, 1],
    ...[-0.0, 0.2, 0, 1],
    ...[+0.1, 0.0, 0, 1],
  ]),
  gl.STATIC_DRAW,
);

gl.bufferData(
  gl.ELEMENT_ARRAY_BUFFER,
  new Uint32Array([0, 1, 2, 0, 1, 2]),
  gl.STATIC_DRAW,
);

// position = 0
gl.vertexAttribPointer(
  0,
  4,
  gl.FLOAT,
  false,
  4 * Float32Array.BYTES_PER_ELEMENT,
  0,
);
gl.enableVertexAttribArray(0);

const zero = document.timeline.currentTime;

gl.useProgram(program);
gl.bindVertexArray(vao);
gl.bindBuffer(gl.ARRAY_BUFFER, cbo);

// position = 1
gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(1);

function render(timestamp) {
  const elapsed = timestamp - zero;
  const a = (elapsed * 0.0003) % 2;
  const b = (elapsed * 0.0025) % 2;
  const g = 4;

  const rotate = mat4.rotate(mat4.create(), mat4.create(), 0, [0, 1, 0]);

  // Enable depth testing
  gl.enable(gl.DEPTH_TEST);
  // Near things obscure far things
  gl.depthFunc(gl.LEQUAL);
  // Clear the canvas before we start drawing on it.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(
    uniformModel,
    false,
    mat4.mul(
      mat4.create(),
      // From camera-space to clip-space.
      // a - 1 maps z coordinate from [0, 2) to [-1, 1).
      mat4.translate(mat4.create(), mat4.create(), [-0.5, 0, a - 1]),
      rotate,
    ),
  );
  gl.uniformMatrix4fv(
    uniformProjection,
    false,
    // From camera-space to clip-space.
    mat4.fromValues(
      ...[1, 0, 0, 0],
      ...[0, 1, 0, 0],
      ...[0, 0, a * g, 0],
      ...[0, 0, 0, a * g],
    ),
  );

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      ...[1.0, 0.0, 0.0, 1.0],
      ...[1.0, 0.0, 0.0, 1.0],
      ...[1.0, 0.0, 0.0, 1.0],
    ]),
    gl.STATIC_DRAW,
  );

  gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0);

  gl.uniformMatrix4fv(
    uniformModel,
    false,
    mat4.mul(
      mat4.create(),
      // From camera-space to clip-space.
      // b - 1 maps z coordinate from [0, 2) to [-1, 1).
      mat4.translate(mat4.create(), mat4.create(), [-0.5, 0, b - 1]),
      rotate,
    ),
  );

  gl.uniformMatrix4fv(
    uniformProjection,
    false,
    // From camera-space to clip-space.
    mat4.fromValues(
      ...[1, 0, 0, 0],
      ...[0, 1, 0, 0],
      ...[0, 0, b * g, 0],
      ...[0, 0, 0, b * g],
    ),
  );

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      ...[0.0, 0.0, 0.0, 1.0],
      ...[0.0, 0.0, 0.0, 1.0],
      ...[0.0, 0.0, 0.0, 1.0],
    ]),
    gl.STATIC_DRAW,
  );

  gl.drawElements(
    gl.TRIANGLES,
    3,
    gl.UNSIGNED_INT,
    3 * Uint32Array.BYTES_PER_ELEMENT,
  );

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
