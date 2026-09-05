#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "KinetiStreamGameMode.generated.h"

class UStaticMeshComponent;
class ACameraActor;

UCLASS()
class KINETISTREAM_API AKinetiStreamGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    AKinetiStreamGameMode();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    UFUNCTION() void OnBrowserInput(const FString& Descriptor);
private:
    UPROPERTY() TObjectPtr<AActor> PieceRoot;
    UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Pieces;
    UPROPERTY() TObjectPtr<ACameraActor> Camera;
    float Progress = 0.0f;
    float Explode = 0.0f;
    float PieceOffset = 0.0f;
    float CameraFov = 38.0f;
    int32 SelectedPiece = 26;
    int32 LastSequence = 0;
    bool InputBound = false;
    void ApplyState();
};
