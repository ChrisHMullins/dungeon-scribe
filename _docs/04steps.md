UI Revamp

The app should open to a list of campaigns. 

When you click on a campaign, you can see Sessions, Profiles, Images.

When you click on sessions you see a list of sessions. (no record options at the top)

Clicking on a session takes you to the session detail view.

At the top of a session view it has the option to record a new session. (with live/Entity detection options all checked by default)

Sessions can have multiple recordings, transcripts, profiles, and images associated. 

When you select a transcript you can see the segmented timestamps and can playback sessions. 

Create a clickable prototype poc of the above and allow me to test.


Updates to PoC v1

1. Campaign view - let's make it a list not cards
2. Campaign detail view - sessions tab - Let's list sessions right in the session tab, and not have to click to the list.
3. Campaign detail view - sessions tab - at the top of the list create a "new session buttion"


Updates to PoC v2

1. lets try keeping the header we have on the campaign detail (the sessions, profiles, images tabs) when you click into a session.
2. What if we add the record new session button and options to that header, above the tabs, aligned right.
3. When clicking record it starts and there is a link that let's us go to the live transcript view, or we can stay and look at profiles and images as we play. 


Updates 4a

- when an empty session loads there is an error loading audio. 
- add a button to each time segment to parse for entities. This should allow for a transcript that doesn't do that live to do it later.


Updates 4b

- make the dungeon scribe words in the header clickable and it should return to the home screen.
- remove the campaign name section in the left side nav.
- remove the poc button and clean up those files we don't need them anymore.
- on the campaign detail view, it shows two labels at the top of the screen. Remove the back button and the second name label. 
- after recording, if I record again, the second recording goes missing after I click end. I'd like to be able to have multiple recordings and transcripts per session. We might take a break or pause while playing. double check the order of operations.

Updates 4c

- when I hit stop recording, i don't see the new transcript, but if I switch tabs and comeback it shows up.
- the page scrolls below the bottom of the app window. The transcript should be able to scroll but the bottom should not be below the edge of the app.
- as I make more recordings it's only one transcript that I see. 
- the clicking on sessions doesn't go to the sessions list, it goes to the transcripts. When clicked it should go to the session list.