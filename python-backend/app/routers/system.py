"""
System router for health checks and GPU status
"""

from fastapi import APIRouter
import torch

router = APIRouter()


@router.get("/gpu-status")
async def get_gpu_status():
    """Check GPU/CUDA availability"""
    cuda_available = torch.cuda.is_available()
    
    result = {
        "cuda_available": cuda_available,
        "device_count": 0,
        "devices": []
    }
    
    if cuda_available:
        result["device_count"] = torch.cuda.device_count()
        for i in range(torch.cuda.device_count()):
            device_info = {
                "index": i,
                "name": torch.cuda.get_device_name(i),
                "memory_total": torch.cuda.get_device_properties(i).total_memory,
                "memory_allocated": torch.cuda.memory_allocated(i),
                "memory_reserved": torch.cuda.memory_reserved(i)
            }
            result["devices"].append(device_info)
    
    return result


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
