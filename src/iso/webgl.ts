import type { Frame, PixelImage, Renderer } from './render';
import { writeQuads } from './batch';

/** One atlas and one interleaved triangle batch; no scene or jungle knowledge. */
export class WebGLRenderer implements Renderer {
  readonly name = 'WebGL';
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private texture: WebGLTexture;
  private vertices = new Float32Array(0);
  private attributes: number[];
  private sizeUniform: WebGLUniformLocation | null;
  private gpuCapacity = 0;
  get auxiliaryBytes(): number { return this.vertices.byteLength + this.gpuCapacity; }
  constructor(private canvas: HTMLCanvasElement, private atlas: PixelImage) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (atlas.width > limit || atlas.height > limit) throw new Error(`Atlas exceeds GPU texture limit ${limit}`);
    const shader = (type: number, source: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'Shader compile failure');
      return s;
    };
    const vs = shader(gl.VERTEX_SHADER, `attribute vec2 a_position; attribute vec2 a_uv; attribute vec4 a_color;
      uniform vec2 u_size; varying vec2 v_uv; varying vec4 v_color;
      void main(){ gl_Position=vec4(a_position/u_size*vec2(2.,-2.)+vec2(-1.,1.),0.,1.); v_uv=a_uv; v_color=a_color; }`);
    const fs = shader(gl.FRAGMENT_SHADER, `#ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D u_atlas;
      varying vec2 v_uv; varying vec4 v_color;
      void main(){ vec4 c=texture2D(u_atlas,v_uv)*v_color; gl_FragColor=vec4(c.rgb*c.a,c.a); }`);
    this.program = gl.createProgram()!; gl.attachShader(this.program, vs); gl.attachShader(this.program, fs);
    gl.linkProgram(this.program); gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('Shader linking failed');
    gl.useProgram(this.program);
    this.sizeUniform = gl.getUniformLocation(this.program, 'u_size');
    this.buffer = gl.createBuffer()!; this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.width, atlas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas.data);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.attributes = ['a_position', 'a_uv', 'a_color'].map(n => gl.getAttribLocation(this.program, n));
  }
  render(frame: Frame): void {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    if (this.canvas.width !== frame.width || this.canvas.height !== frame.height) {
      this.canvas.width = frame.width; this.canvas.height = frame.height;
    }
    gl.viewport(0, 0, frame.width, frame.height);
    const alpha = frame.clear[3] / 255;
    gl.clearColor(frame.clear[0] / 255 * alpha, frame.clear[1] / 255 * alpha, frame.clear[2] / 255 * alpha, alpha);
    gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(this.program);
    gl.uniform2f(this.sizeUniform, frame.width, frame.height);
    const length = frame.commands.length * 6 * 8;
    if (length === 0) return;
    if (this.vertices.length < length) this.vertices = new Float32Array(Math.max(length, this.vertices.length * 2));
    writeQuads(frame.commands, this.atlas.width, this.atlas.height, this.vertices);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    if (this.gpuCapacity < this.vertices.byteLength) {
      this.gpuCapacity = this.vertices.byteLength;
      gl.bufferData(gl.ARRAY_BUFFER, this.gpuCapacity, gl.DYNAMIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices.subarray(0, length));
    this.attributes.forEach((a, i) => { gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, i === 2 ? 4 : 2, gl.FLOAT, false, 32, i * 8); });
    gl.bindTexture(gl.TEXTURE_2D, this.texture); gl.drawArrays(gl.TRIANGLES, 0, length / 8);
  }
  dispose(): void { this.gl.deleteTexture(this.texture); this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program); }
}
