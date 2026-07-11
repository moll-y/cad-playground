+++
title = '000 - Basic'
+++


### Goal


### Notes

The Vertex Shader receives vertex data as input. These vertex data are 3D
coordinates (vertices) representing what we want to draw on the screen. These
coordinates range from -1 to 1, which it's called normalized device coordinates
(NDC). Everything outside that range, will be discarded and won't be visible on
the screen. Eventually all the coordinates should end up in this coordinate
space (NDC).


The Vertex Buffer Object (VBO) stores the vertices in the GPU memory. This
buffer as a unique ID, this ID is used to reference the buffer.
