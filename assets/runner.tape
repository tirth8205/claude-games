# VHS tape for recording Claude Runner gameplay
# Run: vhs assets/runner.tape

Output assets/runner.gif

Set Theme "Catppuccin Mocha"
Set FontSize 14
Set Width 900
Set Height 600
Set Padding 20

Type@100ms "node dist/cli.js"
Enter
Sleep 1.5s

# Select Runner (press 1 or Enter since it's default)
Enter
Sleep 1s

# Start with space
Space
Sleep 1s

# Jump over first obstacle
Space
Sleep 800ms

# Wait and jump again
Sleep 600ms
Space
Sleep 800ms

# Duck
Down
Sleep 500ms

# More jumping
Sleep 500ms
Space
Sleep 800ms
Space
Sleep 800ms

# Duck again
Down
Sleep 400ms

Sleep 500ms
Space
Sleep 800ms

# Pause
Type "p"
Sleep 2s

# Resume
Type "p"
Sleep 500ms

Space
Sleep 800ms
Space
Sleep 800ms

# Let it run until game over or quit
Sleep 1s
Type "q"
Sleep 1s
Type "q"
Sleep 1s
