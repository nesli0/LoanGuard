from fastapi import APIRouter, Depends
from src.core.schemas import ApiResponse
from src.modules.simulator.simulator_schemas import LoanSimulationRequest, SimulationResult
from src.modules.simulator import simulator_service
from src.core.dependencies import get_current_user
from src.models.user_model import User

router = APIRouter(prefix="/simulator", tags=["Simulator"])

@router.post("/loan", response_model=ApiResponse[SimulationResult])
async def simulate_loan(
    request: LoanSimulationRequest,
    current_user: User = Depends(get_current_user)
):
    result = simulator_service.calculate_loan_simulation(request)
    return ApiResponse(success=True, data=result)
