using UnrealBuildTool;
public class KinetiStream : ModuleRules
{
    public KinetiStream(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "Json", "PixelStreaming2", "PixelStreaming2Core", "PixelStreaming2Input" });
    }
}
