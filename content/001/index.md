+++
title = '001: Simple Projection with perspective'
+++

### Notes

Previously, the \(w\) component was set equal to \(z\), producing homogeneous
coordinates \((x, y, z, z)\). After the perspective divide, this resulted in
\((x/z, y/z, z/z = 1)\). Forcing the depth (\(z\)) to always be \(1\), and
making `DEPTH_TEST` to not behave as expected. To fix this issue, the following
projection matrix is used to produce homogeneous coordinates \((x, y, z^2,
z)\):

\[
\begin{aligned}
\begin{bmatrix}
1 & 0 & 0 & 0 \\
0 & 1 & 0 & 0 \\
0 & 0 & z & 0 \\
0 & 0 & 0 & z
\end{bmatrix}
\begin{bmatrix}
x \\
y \\
z \\
1
\end{bmatrix}
&=
\begin{bmatrix}
x \\
y \\
z^2 \\
z
\end{bmatrix}
\end{aligned}
\]

This way, after the perspective divide, the result becomes \((x/z, y/z, z)\),
preserving depth and allowing `DEPTH_TEST` to behave as intended.
