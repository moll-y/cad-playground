+++
title = '001: Simple Projection with perspective'
+++

### Notes

Given an input point \((x,y,z)\) in world space, we map it to camera space as:

\[
\begin{aligned}
x*{\text{camera}} &= x, \\
y*{\text{camera}} &= y, \\
z\_{\text{camera}} &= z \operatorname{mod} 2,
\end{aligned}
\]

which wraps the depth coordinate with period 2. The result is then multiplied
by the projection matrix:

\[
\begin{aligned}
\begin{bmatrix}
g & 0 & 0 & 0 \\
0 & g & 0 & 0 \\
0 & 0 & g & -1 \\
0 & 0 & 1 & 0
\end{bmatrix}
\begin{bmatrix}
x*{\text{camera}} \\
y*{\text{camera}} \\
z*{\text{camera}} \\
1
\end{bmatrix}
&=
\begin{bmatrix}
g\,x*{\text{camera}} \\
g\,y*{\text{camera}} \\
g\,z*{\text{camera}} - 1 \\
z\_{\text{camera}}
\end{bmatrix}
\end{aligned}
\]

Here, \((g)\) is called `focal length` of the camera. A short focal length
corresponds to a wide field of view, and a long focal length corresponds to a
narrow field of view. By increasing or decreasing the distance \((g)\), the
camera can be made to zoom in and zoom out, respectively.

### Resources

- [WebGL model view projection](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection#divide_by_w)
