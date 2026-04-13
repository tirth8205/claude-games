# VHS tape for recording the claude-games menu screen
# Run: vhs assets/menu.tape

Output assets/menu.gif

Set Theme "Catppuccin Mocha"
Set FontSize 14
Set Width 900
Set Height 500
Set Padding 20

Type@100ms "node dist/cli.js"
Enter
Sleep 2s

# Show menu for a moment
Sleep 2s

# Move selection to Snake
Right
Sleep 1.5s

# Move back to Runner
Left
Sleep 1.5s

# Quit
Type "q"
Sleep 1s
