using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using inMVC.Data;

#nullable disable

namespace inMVC.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260614150000_ImproveLearnerProfile")]
public partial class ImproveLearnerProfile : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "ContactNumber", table: "LearnerProfiles", type: "TEXT", nullable: false, defaultValue: "");
        migrationBuilder.AddColumn<string>(name: "AccountManager", table: "LearnerProfiles", type: "TEXT", nullable: false, defaultValue: "Learner");
        migrationBuilder.AddColumn<string>(name: "GuardianName", table: "LearnerProfiles", type: "TEXT", nullable: false, defaultValue: "");
        migrationBuilder.AddColumn<string>(name: "GuardianRelationship", table: "LearnerProfiles", type: "TEXT", nullable: false, defaultValue: "");
        migrationBuilder.AddColumn<string>(name: "GuardianContactNumber", table: "LearnerProfiles", type: "TEXT", nullable: false, defaultValue: "");
        migrationBuilder.AddColumn<string>(name: "GuardianEmail", table: "LearnerProfiles", type: "TEXT", nullable: false, defaultValue: "");
        migrationBuilder.AddColumn<string>(name: "LearningGoals", table: "LearnerProfiles", type: "TEXT", nullable: false, defaultValue: "");
        migrationBuilder.AddColumn<string>(name: "PreferredSchedule", table: "LearnerProfiles", type: "TEXT", nullable: false, defaultValue: "");
        migrationBuilder.AddColumn<string>(name: "ProfilePhoto", table: "LearnerProfiles", type: "TEXT", nullable: false, defaultValue: "");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "ContactNumber", table: "LearnerProfiles");
        migrationBuilder.DropColumn(name: "AccountManager", table: "LearnerProfiles");
        migrationBuilder.DropColumn(name: "GuardianName", table: "LearnerProfiles");
        migrationBuilder.DropColumn(name: "GuardianRelationship", table: "LearnerProfiles");
        migrationBuilder.DropColumn(name: "GuardianContactNumber", table: "LearnerProfiles");
        migrationBuilder.DropColumn(name: "GuardianEmail", table: "LearnerProfiles");
        migrationBuilder.DropColumn(name: "LearningGoals", table: "LearnerProfiles");
        migrationBuilder.DropColumn(name: "PreferredSchedule", table: "LearnerProfiles");
        migrationBuilder.DropColumn(name: "ProfilePhoto", table: "LearnerProfiles");
    }
}
