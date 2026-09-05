#include "KinetiStreamGameMode.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/PointLightComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/PointLight.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "Materials/MaterialInterface.h"
#include "GameFramework/PlayerController.h"
#include "IPixelStreaming2Module.h"
#include "IPixelStreaming2Streamer.h"
#include "IPixelStreaming2InputHandler.h"
#include "Serialization/MemoryReader.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

AKinetiStreamGameMode::AKinetiStreamGameMode()
{
    PrimaryActorTick.bCanEverTick = true;
    DefaultPawnClass = nullptr;
}

void AKinetiStreamGameMode::BeginPlay()
{
    Super::BeginPlay();
    PieceRoot = GetWorld()->SpawnActor<AActor>();
    USceneComponent* Root = NewObject<USceneComponent>(PieceRoot, TEXT("AssemblyRoot"));
    PieceRoot->SetRootComponent(Root);
    Root->RegisterComponent();
    UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
    UMaterialInterface* Neutral = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
    for (int32 I = 0; I < 27; ++I)
    {
        UStaticMeshComponent* Piece = NewObject<UStaticMeshComponent>(PieceRoot, *FString::Printf(TEXT("Piece_%02d"), I));
        Piece->SetupAttachment(Root);
        Piece->SetStaticMesh(Cube);
        if (Neutral) Piece->SetMaterial(0, Neutral);
        Piece->SetMobility(EComponentMobility::Movable);
        Piece->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Piece->SetRelativeScale3D(FVector(0.90f));
        Piece->RegisterComponent();
        Pieces.Add(Piece);
    }

    AActor* Floor = GetWorld()->SpawnActor<AActor>();
    UStaticMeshComponent* FloorMesh = NewObject<UStaticMeshComponent>(Floor, TEXT("Floor"));
    Floor->SetRootComponent(FloorMesh);
    FloorMesh->SetStaticMesh(Cube);
    if (Neutral) FloorMesh->SetMaterial(0, Neutral);
    FloorMesh->SetWorldLocation(FVector(0, 0, -270));
    FloorMesh->SetWorldScale3D(FVector(80, 80, .12));
    FloorMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    FloorMesh->RegisterComponent();

    ADirectionalLight* Key = GetWorld()->SpawnActor<ADirectionalLight>(FVector(0, 0, 700), FRotator(-42, -135, 0));
    Key->GetLightComponent()->SetMobility(EComponentMobility::Movable);
    Key->GetLightComponent()->SetIntensity(5.0f);
    Key->GetLightComponent()->SetLightColor(FLinearColor(1.0f, .86f, .70f));
    Cast<UDirectionalLightComponent>(Key->GetLightComponent())->ForwardShadingPriority = 1;
    Key->GetLightComponent()->MarkRenderStateDirty();
    ADirectionalLight* Fill = GetWorld()->SpawnActor<ADirectionalLight>(FVector(0, 0, 600), FRotator(-20, 160, 0));
    Fill->GetLightComponent()->SetMobility(EComponentMobility::Movable);
    Fill->GetLightComponent()->SetIntensity(2.0f);
    Fill->GetLightComponent()->SetLightColor(FLinearColor(.56f, .70f, 1.0f));
    Fill->GetLightComponent()->SetCastShadows(false);

    Camera = GetWorld()->SpawnActor<ACameraActor>();
    const FVector CameraLocation(880, 880, 680);
    Camera->SetActorLocation(CameraLocation);
    Camera->SetActorRotation((-CameraLocation).Rotation());
    Camera->GetCameraComponent()->bConstrainAspectRatio = false;
    Camera->GetCameraComponent()->SetFieldOfView(CameraFov);
    FPostProcessSettings& Post = Camera->GetCameraComponent()->PostProcessSettings;
    Post.bOverride_AutoExposureMethod = true;
    Post.AutoExposureMethod = EAutoExposureMethod::AEM_Manual;
    Post.bOverride_AutoExposureApplyPhysicalCameraExposure = true;
    Post.AutoExposureApplyPhysicalCameraExposure = false;
    Post.bOverride_AutoExposureBias = true;
    Post.AutoExposureBias = 0.0f;
    Post.bOverride_MotionBlurAmount = true;
    Post.MotionBlurAmount = 0.0f;
    if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
    {
        PC->SetViewTarget(Camera);
        PC->bShowMouseCursor = false;
    }
    ApplyState();
    UE_LOG(LogTemp, Display, TEXT("KINETI_READY pieces=%d progress=%.3f"), Pieces.Num(), Progress);
}

void AKinetiStreamGameMode::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!InputBound && IPixelStreaming2Module::IsAvailable() && IPixelStreaming2Module::Get().IsReady())
    {
        IPixelStreaming2Module::Get().ForEachStreamer([this](TSharedPtr<IPixelStreaming2Streamer> Streamer) {
            if (TSharedPtr<IPixelStreaming2InputHandler> Handler = Streamer->GetInputHandler().Pin())
            {
                const TWeakObjectPtr<AKinetiStreamGameMode> WeakThis(this);
                Handler->RegisterMessageHandler(TEXT("UIInteraction"), [WeakThis](FString SourceId, FMemoryReader Message) {
                    uint16 Length = 0;
                    if (Message.TotalSize() - Message.Tell() < 2) return;
                    Message << Length;
                    if (Length > 4096 || Message.TotalSize() - Message.Tell() < Length * 2) return;
                    FString Descriptor;
                    Descriptor.Reserve(Length);
                    for (uint16 I = 0; I < Length; ++I) { uint16 Character; Message << Character; Descriptor.AppendChar(static_cast<TCHAR>(Character)); }
                    if (WeakThis.IsValid()) WeakThis->OnBrowserInput(Descriptor);
                });
                InputBound = true;
                UE_LOG(LogTemp, Display, TEXT("KINETI_INPUT_BOUND PixelStreaming2 streamer=%s"), *Streamer->GetId());
            }
        });
    }
}

void AKinetiStreamGameMode::ApplyState()
{
    const float Spread = 98.0f + Explode * 75.0f;
    for (int32 I = 0; I < Pieces.Num(); ++I)
    {
        const FVector Grid((I / 9) - 1, ((I / 3) % 3) - 1, (I % 3) - 1);
        const FVector Assembled = Grid * Spread;
        const FVector Field(((I % 9) - 4) * 105.0f, ((I / 9) - 1) * 105.0f, -95.0f + FMath::Sin(I * .61f) * 45.0f);
        FVector Position = FMath::Lerp(Assembled, Field, Progress);
        if (I == SelectedPiece) Position.Z += PieceOffset * 100.0f;
        Pieces[I]->SetRelativeLocation(Position);
        Pieces[I]->SetRelativeRotation(FRotator(Progress * ((I % 3) - 1) * 30.0f, Progress * I * 8.0f, 0));
    }
    PieceRoot->SetActorRotation(FRotator(0, Progress * 35.0f, 0));
    if (Camera) Camera->GetCameraComponent()->SetFieldOfView(CameraFov);
}

void AKinetiStreamGameMode::OnBrowserInput(const FString& Descriptor)
{
    TSharedPtr<FJsonObject> Json;
    const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Descriptor);
    if (!FJsonSerializer::Deserialize(Reader, Json) || !Json.IsValid()) return;
    double Value = 0;
    if (Json->TryGetNumberField(TEXT("progress"), Value)) Progress = FMath::Clamp(static_cast<float>(Value), 0.0f, 1.0f);
    if (Json->TryGetNumberField(TEXT("explode"), Value)) Explode = FMath::Clamp(static_cast<float>(Value), 0.0f, 2.0f);
    if (Json->TryGetNumberField(TEXT("pieceOffset"), Value)) PieceOffset = FMath::Clamp(static_cast<float>(Value), -2.0f, 2.0f);
    if (Json->TryGetNumberField(TEXT("cameraFov"), Value)) CameraFov = FMath::Clamp(static_cast<float>(Value), 20.0f, 80.0f);
    if (Json->TryGetNumberField(TEXT("selectedPiece"), Value)) SelectedPiece = FMath::Clamp(static_cast<int32>(Value), 0, 26);
    if (Json->TryGetNumberField(TEXT("sequence"), Value)) LastSequence = static_cast<int32>(Value);
    ApplyState();
    const FVector Selected = Pieces[SelectedPiece]->GetRelativeLocation();
    const int32 OtherIndex = SelectedPiece == 0 ? 1 : 0;
    const FVector Other = Pieces[OtherIndex]->GetRelativeLocation();
    const FString Response = FString::Printf(TEXT("{\"kind\":\"kineti-state\",\"sequence\":%d,\"pieces\":%d,\"progress\":%.6f,\"explode\":%.6f,\"selectedPiece\":%d,\"pieceOffset\":%.6f,\"cameraFov\":%.6f,\"selected\":[%.6f,%.6f,%.6f],\"other\":[%.6f,%.6f,%.6f]}"), LastSequence, Pieces.Num(), Progress, Explode, SelectedPiece, PieceOffset, CameraFov, Selected.X, Selected.Y, Selected.Z, Other.X, Other.Y, Other.Z);
    IPixelStreaming2Module::Get().ForEachStreamer([&Response](TSharedPtr<IPixelStreaming2Streamer> Streamer) {
        Streamer->SendAllPlayersMessage(TEXT("Response"), Response);
    });
    UE_LOG(LogTemp, Display, TEXT("KINETI_CONTROL %s"), *Response);
}
