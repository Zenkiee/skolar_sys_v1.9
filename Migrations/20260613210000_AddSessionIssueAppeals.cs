using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using inMVC.Data;

#nullable disable

namespace inMVC.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260613210000_AddSessionIssueAppeals")]
public partial class AddSessionIssueAppeals : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "CompletionIssueStatus",
            table: "Bookings",
            type: "TEXT",
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<string>(
            name: "TutorIssueResponse",
            table: "Bookings",
            type: "TEXT",
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<DateTime>(
            name: "TutorIssueRespondedAt",
            table: "Bookings",
            type: "TEXT",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "AdminIssueResolution",
            table: "Bookings",
            type: "TEXT",
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<string>(
            name: "AdminIssueResolutionNote",
            table: "Bookings",
            type: "TEXT",
            nullable: false,
            defaultValue: "");

        migrationBuilder.AddColumn<DateTime>(
            name: "AdminIssueResolvedAt",
            table: "Bookings",
            type: "TEXT",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "AdminIssueResolvedBy",
            table: "Bookings",
            type: "INTEGER",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "CompletionIssueStatus", table: "Bookings");
        migrationBuilder.DropColumn(name: "TutorIssueResponse", table: "Bookings");
        migrationBuilder.DropColumn(name: "TutorIssueRespondedAt", table: "Bookings");
        migrationBuilder.DropColumn(name: "AdminIssueResolution", table: "Bookings");
        migrationBuilder.DropColumn(name: "AdminIssueResolutionNote", table: "Bookings");
        migrationBuilder.DropColumn(name: "AdminIssueResolvedAt", table: "Bookings");
        migrationBuilder.DropColumn(name: "AdminIssueResolvedBy", table: "Bookings");
    }
}
