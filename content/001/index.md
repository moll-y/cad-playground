+++
title = '001 - Infinite projection'
+++

### Goal
Understand projections.

### Notes

Given an input point \((𝑥_{\text{world}},𝑦_{\text{world}},𝑧_{\text{world}})\)
in world space, where \(𝑥∈[−1,1]\), \(𝑦∈[−1,1]\), and \(z∈[−1,1]\), we map it
to camera space as follows:

\[
\begin{aligned}
x_{\text{camera}} &= x_{\text{world}} \\
y_{\text{camera}} &= y_{\text{world}} \\
z_{\text{camera}} &= z_{\text{world}} + 1
\end{aligned}
\]

The result is then multiplied by the infinite projection matrix with \(n=0.1\)
(near plane), \(s=1.0\) (spect ratio), and \(g=0.1\) (focal length):

\[
\begin{aligned}
\begin{bmatrix}
\frac{g}{s} & 0 & 0 & 0 \\
0           & g & 0 & 0 \\
0           & 0 & 1 & -n \\
0           & 0 & 1 & 0
\end{bmatrix}
\begin{bmatrix}
x_{\text{camera}} \\
y_{\text{camera}} \\
z_{\text{camera}} \\
1
\end{bmatrix}
&=
\begin{bmatrix}
\frac{g}{s} \times x_{\text{camera}} \\
g \times y_{\text{camera}} \\
z_{\text{camera}} - n \\
z_{\text{camera}}
\end{bmatrix}
\end{aligned}
\]

A short focal length corresponds to a wide field of view, and a long focal
length corresponds to a narrow field of view. By increasing or decreasing the
distance \(g\), the camera can be made to zoom in and zoom out, respectively.
The previous transformation produces coordinates in clip space
\((𝑥_{\text{clip}},𝑦_{\text{clip}},𝑧_{\text{clip}})\).

### Resources

- [WebGL model view projection](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection#divide_by_w)
