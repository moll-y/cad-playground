import { mat4, glMatrix } from "gl-matrix";

new EventSource("/esbuild").addEventListener("change", () => location.reload());

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
  `#version 300 es                          \n
                                            \n
  layout (location = 0) in vec4 position;   \n
                                            \n
  uniform mat4 transform;                   \n
                                            \n
  void main(void) {                         \n
      gl_Position = transform * position;   \n
  }`,
);

gl.compileShader(vshader);
if (!gl.getShaderParameter(vshader, gl.COMPILE_STATUS)) {
  throw new Error(`could not compile vshader: ${gl.getShaderInfoLog(vshader)}`);
}

const fshader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(
  fshader,
  `#version 300 es                          \n
                                            \n
  precision highp float;                    \n
                                            \n
  out vec4 color;                           \n
                                            \n
  void main(void) {                         \n
      color = vec4(1.0, 0.0, 0.0, 1.0);     \n
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

const uniform = gl.getUniformLocation(program, "transform");
if (uniform === null) {
  throw new Error(`could not find uniform location: "transform".`);
}

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([
    ...[-0.15, -0.15, 0, 1],
    ...[0.15, -0.15, 0, 1],
    ...[0, 0.15, 0, 1],
  ]),
  gl.STATIC_DRAW,
);
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

function render(timestamp) {
  const elapsed = timestamp - zero;

  const rotation = mat4.create();
  mat4.rotate(
    rotation,
    mat4.create(),
    glMatrix.toRadian(0.1 * elapsed),
    [0, 1, 0],
  );

  const z = 1 - ((0.0001 * elapsed) % 1);
  const translation = mat4.create();
  mat4.translate(translation, mat4.create(), [0, 0, z]);

  const projection = mat4.fromValues(
    ...[1, 0, 0, 0],
    ...[0, 1, 0, 0],
    ...[0, 0, 1, z],
    ...[0, 0, 0, z],
  );

  const mul = mat4.create();
  mat4.mul(mul, translation, rotation);
  mat4.mul(mul, projection, mul);

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.uniformMatrix4fv(uniform, false, mul);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
