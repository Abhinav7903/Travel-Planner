package auth

import "testing"

func TestAuthorizationMatrix(t *testing.T) {
	roles := []string{"", "viewer", "editor", "owner"}
	actions := []Action{
		ActionReadTrip, ActionEditTrip, ActionManageTrip, ActionInvite,
		ActionManageMember, ActionManageGroup, ActionEditContent, ActionManageMoney,
	}
	expected := map[Action]map[string]bool{
		ActionReadTrip:     {"viewer": true, "editor": true, "owner": true},
		ActionEditTrip:     {"editor": true, "owner": true},
		ActionManageTrip:   {"owner": true},
		ActionInvite:       {"editor": true, "owner": true},
		ActionManageMember: {"owner": true},
		ActionManageGroup:  {"editor": true, "owner": true},
		ActionEditContent:  {"editor": true, "owner": true},
		ActionManageMoney:  {"editor": true, "owner": true},
	}
	for _, action := range actions {
		for _, role := range roles {
			want := expected[action][role]
			if got := Allowed(role, action); got != want {
				t.Errorf("Allowed(%q, %q) = %v, want %v", role, action, got, want)
			}
		}
	}
	if Allowed("owner", Action("unknown")) {
		t.Fatal("unknown actions must be denied")
	}
}
