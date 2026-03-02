"""
Geometry service for PMUT shape processing
"""

import math
import numpy as np
from typing import Tuple, List
from app.schemas.geometry import GeometryInput, CellShape, ShapeFileData


class GeometryService:
    """Service for geometry validation and processing"""
    
    def validate(self, geometry: GeometryInput) -> Tuple[bool, str]:
        """Validate geometry parameters"""
        
        # Check shape-specific parameters
        if geometry.cell_shape == CellShape.CIRCULAR:
            if geometry.radius is None or geometry.radius <= 0:
                return False, "Radius must be specified and positive for circular shapes"
                
        elif geometry.cell_shape == CellShape.RECTANGULAR:
            if geometry.length is None or geometry.length <= 0:
                return False, "Length must be specified and positive for rectangular shapes"
            if geometry.width is None or geometry.width <= 0:
                return False, "Width must be specified and positive for rectangular shapes"
                
        elif geometry.cell_shape == CellShape.CUSTOM:
            if geometry.shape_data is None:
                return False, "Shape data must be provided for custom shapes"
        
        # Check layer thicknesses
        if geometry.silicon_thickness <= 0:
            return False, "Silicon thickness must be positive"
        if geometry.piezo_thickness <= 0:
            return False, "Piezoelectric thickness must be positive"
            
        # Check array configuration
        if geometry.cell_number_x < 1 or geometry.cell_number_y < 1:
            return False, "Cell numbers must be at least 1"
            
        return True, "Geometry is valid"
    
    def calculate_area(self, geometry: GeometryInput) -> float:
        """Calculate total active area in μm²"""
        
        single_cell_area = 0.0
        
        if geometry.cell_shape == CellShape.CIRCULAR:
            single_cell_area = math.pi * (geometry.radius ** 2)
            
        elif geometry.cell_shape == CellShape.RECTANGULAR:
            single_cell_area = geometry.length * geometry.width
            
        elif geometry.cell_shape == CellShape.HEXAGONAL:
            # Assuming regular hexagon with given side length
            side = geometry.radius if geometry.radius else 50.0
            single_cell_area = (3 * math.sqrt(3) / 2) * (side ** 2)
            
        elif geometry.cell_shape == CellShape.CUSTOM:
            # Calculate from shape data using shoelace formula
            if geometry.shape_data:
                single_cell_area = self._calculate_polygon_area(geometry.shape_data)
        
        total_cells = geometry.cell_number_x * geometry.cell_number_y
        return single_cell_area * total_cells
    
    def _calculate_polygon_area(self, shape_data: str) -> float:
        """Calculate area of polygon using shoelace formula"""
        try:
            lines = shape_data.strip().split('\n')
            vertices = []
            for line in lines:
                parts = line.strip().split()
                if len(parts) >= 2:
                    vertices.append((float(parts[0]), float(parts[1])))
            
            if len(vertices) < 3:
                return 0.0
                
            # Shoelace formula
            n = len(vertices)
            area = 0.0
            for i in range(n):
                j = (i + 1) % n
                area += vertices[i][0] * vertices[j][1]
                area -= vertices[j][0] * vertices[i][1]
            return abs(area) / 2.0
            
        except Exception:
            return 0.0
    
    def generate_visualization(self, geometry: GeometryInput) -> dict:
        """Generate visualization data for the geometry"""
        
        viz_data = {
            "cells": [],
            "array_bounds": {
                "width": geometry.pitch_x * geometry.cell_number_x,
                "height": geometry.pitch_y * geometry.cell_number_y
            }
        }
        
        # Generate cell positions
        for i in range(geometry.cell_number_x):
            for j in range(geometry.cell_number_y):
                cell = {
                    "x": i * geometry.pitch_x + geometry.pitch_x / 2,
                    "y": j * geometry.pitch_y + geometry.pitch_y / 2,
                    "shape": geometry.cell_shape.value
                }
                
                if geometry.cell_shape == CellShape.CIRCULAR:
                    cell["radius"] = geometry.radius
                elif geometry.cell_shape == CellShape.RECTANGULAR:
                    cell["length"] = geometry.length
                    cell["width"] = geometry.width
                    
                viz_data["cells"].append(cell)
        
        return viz_data
    
    def parse_shape_file(self, content: str) -> ShapeFileData:
        """Parse uploaded shape file"""
        
        lines = content.strip().split('\n')
        vertices = []
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
                
            parts = line.split()
            if len(parts) >= 2:
                try:
                    x, y = float(parts[0]), float(parts[1])
                    vertices.append([x, y])
                except ValueError:
                    continue
        
        if len(vertices) < 3:
            raise ValueError("Shape file must contain at least 3 vertices")
        
        # Calculate bounding box
        xs = [v[0] for v in vertices]
        ys = [v[1] for v in vertices]
        
        bounding_box = {
            "min_x": min(xs),
            "max_x": max(xs),
            "min_y": min(ys),
            "max_y": max(ys),
            "width": max(xs) - min(xs),
            "height": max(ys) - min(ys)
        }
        
        # Calculate centroid
        centroid = [sum(xs) / len(xs), sum(ys) / len(ys)]
        
        return ShapeFileData(
            vertices=vertices,
            num_points=len(vertices),
            bounding_box=bounding_box,
            centroid=centroid
        )
