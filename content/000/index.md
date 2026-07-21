+++
title = '000 - Coordinate Systems'
+++

### Theory

- A object is composed of a set of vertex coordinates.

- There are different coordinate systems, the important ones for this topic
  are: Local Space and World Space.

- The vertex coordinates of an object first start in **local space** as local
  coordinates and are then further processed to **world coordinate**.

- The parent's world transform places us in the parent's coordinate space. The
  child's local transform then describes how the child object is positioned,
  rotated, and scaled relative to that parent.

- As a result, transformations applied to the parent also affect the child.

- To compute the child's transform in world space, compose the parent's world
  transform with the child's local transform:

  \[
  C_{\mathrm{world}} = P_{\mathrm{world}} \times C_{\mathrm{local}}
  \]

### Example

- Suppose a parent object is positioned at \((100, 50)\) in world space. Its
  world matrix is:

  \[
  P_{\mathrm{world}} =
  \begin{pmatrix}
  1 & 0 & 100 \\
  0 & 1 & 50 \\
  0 & 0 & 1
  \end{pmatrix}
  \]

- Now suppose a child object is positioned at \((25, 10)\) relative to its
  parent. Its local matrix is:

  \[
  C_{\mathrm{local}} =
  \begin{pmatrix}
  1 & 0 & 25 \\
  0 & 1 & 10 \\
  0 & 0 & 1
  \end{pmatrix}
  \]

- The child's world matrix is obtained by composing the parent's world matrix
  with the child's local matrix:

  \[
  C_{\mathrm{world}} = P_{\mathrm{world}} \times C_{\mathrm{local}}
  \]

- In this case, the parent is positioned at \((100, 50)\), and the child is
  positioned at \((25, 10)\) relative to the parent. Therefore, the child is
  positioned at \((125, 60)\) in world space:

  \[
  C_{\mathrm{world}} =
  \begin{pmatrix}
  (1 \times 1) + (0 \times 0) + (100 \times 0) &
  (1 \times 0) + (0 \times 1) + (100 \times 0) &
  (1 \times 25) + (0 \times 10) + (100 \times 1)
  \\
  (0 \times 1) + (1 \times 0) + (50 \times 0) &
  (0 \times 0) + (1 \times 1) + (50 \times 0) &
  (0 \times 25) + (1 \times 10) + (50 \times 1)
  \\
  (0 \times 1) + (0 \times 0) + (1 \times 0) &
  (0 \times 0) + (0 \times 1) + (1 \times 0) &
  (0 \times 25) + (0 \times 10) + (1 \times 1)
  \end{pmatrix}
  \]

  \[
  C_{\mathrm{world}} =
  \begin{pmatrix}
  1 & 0 & 125 \\
  0 & 1 & 60 \\
  0 & 0 & 1
  \end{pmatrix}
  \]
